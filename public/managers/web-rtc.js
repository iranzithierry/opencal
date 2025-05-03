export class WebRTCManager {
  constructor(signalingManager) {
    this.peerConnection = null;
    this.signalingManager = signalingManager; // To send ICE candidates
    this.onRemoteTrackCallback = null;
    this.onConnectionLostCallback = null;
    this.iceServers = [{ urls: "stun:stun.l.google.com:19302" }];
    console.log("WebRTCManager initialized.");
  }

  _createPeerConnection() {
    if (this.peerConnection) {
      this.peerConnection.close();
    }
    this.peerConnection = new RTCPeerConnection({ iceServers: this.iceServers });
    console.log("RTCPeerConnection created.");

    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate && this.signalingManager.developerID) {
        this.signalingManager.sendIceCandidate(event.candidate, this.signalingManager.developerID);
      }
    };

    this.peerConnection.ontrack = (event) => {
      console.log("Remote track received.");
      if (this.onRemoteTrackCallback) {
        this.onRemoteTrackCallback(event.streams[0]);
      } else {
        // Default handling if no callback provided
        const remoteAudio = new Audio();
        remoteAudio.srcObject = event.streams[0];
        remoteAudio.play().catch((e) => console.error("Audio play failed:", e));
      }
    };

    this.peerConnection.onconnectionstatechange = () => {
      console.log("Peer Connection State:", this.peerConnection?.connectionState);
      const state = this.peerConnection?.connectionState;
      if (state === "disconnected" || state === "failed" || state === "closed") {
        console.log("Peer connection lost or closed.");
        if (this.onConnectionLostCallback) {
          this.onConnectionLostCallback(state);
        }
      }
    };
  }

  async createOfferAndSetLocalDescription() {
    if (!this.peerConnection) this._createPeerConnection();
    try {
      const offer = await this.peerConnection.createOffer();
      await this.peerConnection.setLocalDescription(offer);
      console.log("Offer created and local description set.");
      return offer;
    } catch (error) {
      console.error("Failed to create offer:", error);
      throw error;
    }
  }

  async handleOfferAndCreateAnswer(offer) {
    if (!this.peerConnection) this._createPeerConnection(); // Ensure PC exists
    try {
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
      console.log("Remote description set (offer).");
      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);
      console.log("Answer created and local description set.");
      return answer;
    } catch (error) {
      console.error("Failed to handle offer or create answer:", error);
      throw error;
    }
  }

  async handleAnswer(answer) {
    if (!this.peerConnection) {
      console.error("Cannot handle answer: PeerConnection does not exist.");
      return;
    }
    try {
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
      console.log("Remote description set (answer).");
    } catch (error) {
      console.error("Failed to set remote description (answer):", error);
    }
  }

  addLocalStreamTracks(stream) {
    if (!this.peerConnection) this._createPeerConnection();
    if (stream) {
      stream.getTracks().forEach((track) => {
        if (!this.peerConnection.getSenders().find((sender) => sender.track === track)) {
          this.peerConnection.addTrack(track, stream);
          console.log("Local track added to PeerConnection.");
        }
      });
    }
  }

  async addIceCandidate(candidate) {
    if (this.peerConnection && candidate) {
      try {
        await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        // console.log("ICE candidate added."); // Can be noisy
      } catch (e) {
        console.error("Error adding received ICE candidate:", e);
      }
    }
  }

  closeConnection() {
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
      console.log("PeerConnection closed.");
    }
  }
}
