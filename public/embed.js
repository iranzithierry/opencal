import { EmbedConfig } from "./managers/config.js";
import { UIManager } from "./managers/ui.js";
import { StreamManager } from "./managers/stream.js";
import { WebRTCManager } from "./managers/web-rtc.js";
import { SignalingManager } from "./managers/signaling.js";

document.addEventListener("DOMContentLoaded", () => {
  // including all the managers

  class CallController {
    constructor() {
      this.config = new EmbedConfig();
      this.uiManager = new UIManager();
      this.streamManager = new StreamManager();
      // Pass this.signalingManager reference to webrtcManager
      this.signalingManager = new SignalingManager(this.config.serverUrl);
      this.webRTCManager = new WebRTCManager(this.signalingManager); // Pass signaling manager reference

      this.myID = null;
      this.developerID = null; // The ID of the peer we are talking to or receiving a call from
      this.callOngoing = false;
      this.incomingOffer = null;

      this._setupSignalingCallbacks();
      this._setupWebRTCCallbacks();
      this.uiManager.setupEventHandlers(this); // Pass controller reference to UI

      this.signalingManager.connect(); // Initiate connection

      console.log("CallController initialized.");
    }

    _setupSignalingCallbacks() {
      this.signalingManager.onIdAssignedCallback = (id) => {
        this.myID = id;
        this.uiManager.updateMyID(id);
        this.uiManager.showStatusMessage(`Connected (ID: ${id})`);
      };

      this.signalingManager.onConnectErrorCallback = (errorMessage) => {
        this.uiManager.showStatusMessage(`Connection Error: ${errorMessage}`, true);
        // Potentially implement retry logic here or inform the user
      };

      this.signalingManager.onDisconnectCallback = (reason) => {
        this.uiManager.showStatusMessage(`Disconnected: ${reason}`, true);
        this.resetCallState(false); // Reset state without notifying peer (already disconnected)
        this.uiManager.updateMyID("Disconnected");
      };

      this.signalingManager.onCallMadeCallback = (offer, fromId) => {
        if (this.callOngoing) {
          console.log("Rejecting call - already in progress.");
          this.signalingManager.sendReject(fromId);
          return;
        }
        // Set the developer ID only when a call is actually made
        this.developerID = fromId;
        // Also update the signaling manager's developer ID for ICE candidate sending
        this.signalingManager.developerID = fromId;
        this.incomingOffer = offer;
        this.uiManager.showCallModal(fromId);
      };

      // Handle answer (primarily for developer client, but good to have)
      this.signalingManager.onAnswerMadeCallback = async (answer, fromId) => {
        if (fromId === this.developerID) {
          await this.webRTCManager.handleAnswer(answer);
        } else {
          console.warn(`Received answer from unexpected ID: ${fromId}`);
        }
      };

      this.signalingManager.onIceCandidateCallback = (candidate, fromId) => {
        // Only process candidates from the peer we are interacting with
        if (fromId === this.developerID) {
          this.webRTCManager.addIceCandidate(candidate);
        } else {
          // console.warn(`Received ICE candidate from unexpected ID: ${fromId}`);
        }
      };

      this.signalingManager.onHangupCallback = (fromId, reason) => {
        if (fromId === this.developerID) {
          console.log(`Call ended by peer ${fromId}. Reason: ${reason}`);
          this.resetCallState(false, "Call ended by developer"); // Don't notify peer back
        }
      };

      this.signalingManager.onRejectCallback = (fromId) => {
        if (fromId === this.developerID) {
          console.log(`Call rejected by ${fromId}`);
          // If we initiated the call, we'd reset state here. User client doesn't initiate.
          this.resetCallState(false, "Call rejected");
        }
      };
    }

    _setupWebRTCCallbacks() {
      this.webRTCManager.onRemoteTrackCallback = (stream) => {
        // Play the remote audio
        const remoteAudio = new Audio();
        remoteAudio.srcObject = stream;
        // Ensure it's added to the DOM or handled appropriately if needed
        document.body.appendChild(remoteAudio); // Simple way, might want better handling
        remoteAudio.play().catch((e) => console.error("Remote audio playback failed:", e));
        console.log("Playing remote audio stream.");
        // Clean up audio element on call end
        remoteAudio.onended = () => remoteAudio.remove();
        this.remoteAudioElement = remoteAudio; // Store reference for cleanup
      };

      this.webRTCManager.onConnectionLostCallback = (state) => {
        if (this.callOngoing) {
          console.log(`WebRTC connection lost. State: ${state}`);
          this.resetCallState(true, "Connection lost"); // Notify peer if possible
        }
      };
    }

    async acceptCall() {
      this.uiManager.hideCallModal();
      if (!this.developerID || !this.incomingOffer) {
        console.error("Cannot accept call: Missing developer ID or offer.");
        this.resetCallState(false); // Reset local state
        return;
      }

      try {
        const stream = await this.streamManager.getLocalAudioStream();
        // Important: Init/Re-init PeerConnection *after* getting stream if needed
        this.webRTCManager._createPeerConnection(); // Ensures fresh state before adding tracks/handling offer
        this.webRTCManager.addLocalStreamTracks(stream); // Add tracks *before* handling offer

        const answer = await this.webRTCManager.handleOfferAndCreateAnswer(this.incomingOffer);
        this.signalingManager.sendAnswer(answer, this.developerID);

        this.callOngoing = true;
        this.incomingOffer = null; // Clear the stored offer
        this.uiManager.showOngoingCallIndicator();
        this.uiManager.showStatusMessage("Call accepted");
      } catch (error) {
        console.error("Failed to accept call:", error);
        this.uiManager.showStatusMessage(`Error accepting call: ${error.message}`, true);
        this.resetCallState(true); // Attempt to notify peer of failure? Maybe just reset locally.
        // Consider sending a specific error signal if needed
      }
    }

    denyCall() {
      this.uiManager.hideCallModal();
      if (this.developerID) {
        console.log(`Denying call from ${this.developerID}`);
        this.signalingManager.sendReject(this.developerID);
      }
      this.resetCallState(false); // Reset state without notification
    }

    hangUpCall(notifyPeer = true) {
      console.log(`Hanging up call. Notify peer: ${notifyPeer}`);
      if (notifyPeer && this.developerID) {
        this.signalingManager.sendHangup(this.developerID);
      }
      this.resetCallState(false, "Call ended"); // Reset state, don't re-notify
    }

    resetCallState(notifyPeer = false, uiMessage = null) {
      console.log(`Resetting call state. Notify peer: ${notifyPeer}`);
      if (notifyPeer && this.developerID) {
        // This might be redundant if hangup was already sent, but covers connection loss cases
        this.signalingManager.sendHangup(this.developerID);
      }

      this.webRTCManager.closeConnection();
      this.streamManager.cleanupLocalStream();

      // Clean up remote audio element if it exists
      if (this.remoteAudioElement) {
        this.remoteAudioElement.pause();
        this.remoteAudioElement.srcObject = null;
        this.remoteAudioElement.remove();
        this.remoteAudioElement = null;
        console.log("Remote audio element cleaned up.");
      }

      this.developerID = null;
      this.signalingManager.developerID = null; // Also clear in signaling manager
      this.callOngoing = false;
      this.incomingOffer = null;

      this.uiManager.resetUI();
      if (uiMessage) {
        this.uiManager.showStatusMessage(uiMessage);
      }
      console.log("Call state reset.");
    }
  }

  // --- Initialization ---
  const controller = new CallController();

  // Optional: Make controller accessible globally for debugging
  // window.ocCallController = controller;
}); // end DOMContentLoaded
