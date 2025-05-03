export class SignalingManager {
  constructor(serverUrl) {
    this.socket = null;
    this.serverUrl = serverUrl;
    this.myID = null;
    this.developerID = null; // ID of the peer
    this.onConnectCallback = null;
    this.onDisconnectCallback = null;
    this.onIdAssignedCallback = null;
    this.onCallMadeCallback = null; // (offer, fromId)
    this.onAnswerMadeCallback = null; // (answer, fromId)
    this.onIceCandidateCallback = null; // (candidate, fromId)
    this.onHangupCallback = null; // (fromId, reason)
    this.onRejectCallback = null; // (fromId)
    this.onConnectErrorCallback = null;
    console.log("SignalingManager initialized.");
  }

  loadSocketIOIfNeeded(callback) {
    if (typeof io === "undefined") {
      console.log("Socket.IO not found, loading script...");
      const script = document.createElement("script");
      script.src = "https://cdn.socket.io/4.5.4/socket.io.min.js"; // Consider making this configurable
      script.onload = () => {
        console.log("Socket.IO loaded dynamically.");
        callback();
      };
      script.onerror = (err) => {
        console.error("Failed to load Socket.IO script.", err);
        if (this.onConnectErrorCallback) {
          this.onConnectErrorCallback("Failed to load Socket.IO library");
        }
      };
      document.head.appendChild(script);
    } else {
      console.log("Socket.IO already available.");
      callback(); // Already loaded
    }
  }

  connect() {
    this.loadSocketIOIfNeeded(() => {
      if (this.socket && this.socket.connected) {
        console.log("Already connected to signaling server.");
        return;
      }
      console.log(`Connecting to signaling server: ${this.serverUrl}`);
      this.socket = io(this.serverUrl, {
        query: { clientType: "user" },
        reconnectionAttempts: 3, // Example: limit reconnection attempts
      });
      this._setupSocketListeners();
    });
  }

  _setupSocketListeners() {
    this.socket.on("connect", () => {
      console.log("Connected to signaling server with ID:", this.socket.id);
      // Note: We use the ID assigned by the server via 'yourID' event
      if (this.onConnectCallback) this.onConnectCallback();
    });

    this.socket.on("disconnect", (reason) => {
      console.log("Disconnected from signaling server:", reason);
      this.myID = null;
      // Keep developerID potentially, maybe connection will recover?
      // Or reset it: this.developerID = null;
      if (this.onDisconnectCallback) this.onDisconnectCallback(reason);
    });

    this.socket.on("connect_error", (err) => {
      console.error("Signaling connection error:", err.message);
      if (this.onConnectErrorCallback) this.onConnectErrorCallback(err.message);
    });

    this.socket.on("yourID", (id) => {
      console.log("Received our ID:", id);
      this.myID = id;
      if (this.onIdAssignedCallback) this.onIdAssignedCallback(id);
    });

    this.socket.on("call-made", (data) => {
      // { offer, from }
      console.log(`Incoming call offer from ${data.from}`);
      // Important: Set the developerID here when the call is initiated
      // this.developerID = data.from;
      if (this.onCallMadeCallback) this.onCallMadeCallback(data.offer, data.from);
    });

    this.socket.on("answer-made", (data) => {
      // { answer, from }
      console.log(`Received answer from ${data.from}`);
      if (this.onAnswerMadeCallback) this.onAnswerMadeCallback(data.answer, data.from);
    });

    this.socket.on("ice-candidate", (data) => {
      // { candidate, from }
      // console.log(`Received ICE candidate from ${data.from}`); // Noisy
      if (this.onIceCandidateCallback) this.onIceCandidateCallback(data.candidate, data.from);
    });

    this.socket.on("hangup-call", (data) => {
      // { from, reason }
      console.log(`Received hangup from ${data.from}, reason: ${data.reason || "N/A"}`);
      if (this.onHangupCallback) this.onHangupCallback(data.from, data.reason);
    });

    this.socket.on("reject-call", (data) => {
      // { from }
      console.log(`Call rejected by ${data.from}`);
      if (this.onRejectCallback) this.onRejectCallback(data.from);
    });
  }

  sendOffer(offer, toId) {
    // User client doesn't initiate calls in this design
    console.warn("User client does not send offers.");
  }

  sendAnswer(answer, toId) {
    if (this.socket && this.socket.connected) {
      this.socket.emit("make-answer", { answer, to: toId });
      console.log(`Sent answer to ${toId}`);
    } else {
      console.error("Cannot send answer: Socket not connected.");
    }
  }

  sendIceCandidate(candidate, toId) {
    if (this.socket && this.socket.connected && toId) {
      this.socket.emit("ice-candidate", { candidate, to: toId });
      // console.log(`Sent ICE candidate to ${toId}`); // Noisy
    } else {
      // console.warn("Cannot send ICE candidate: Socket not connected or no target ID.");
    }
  }

  sendHangup(toId) {
    if (this.socket && this.socket.connected && toId) {
      this.socket.emit("hangup-call", { to: toId });
      console.log(`Sent hangup to ${toId}`);
    } else {
      console.warn("Cannot send hangup: Socket not connected or no target ID.");
    }
  }

  sendReject(toId) {
    if (this.socket && this.socket.connected && toId) {
      this.socket.emit("reject-call", { to: toId });
      console.log(`Sent reject to ${toId}`);
    } else {
      console.warn("Cannot send reject: Socket not connected or no target ID.");
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      console.log("Signaling socket disconnected manually.");
    }
  }
}
