export class StreamManager {
  constructor() {
    this.localStream = null;
    console.log("StreamManager initialized.");
  }

  async getLocalAudioStream() {
    if (this.localStream) return this.localStream;
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      console.log("Microphone access granted.");
      return this.localStream;
    } catch (error) {
      console.error("Error accessing media devices.", error);
      alert("Could not access your microphone. Please check permissions.");
      throw error; // Propagate error to stop call process
    }
  }

  cleanupLocalStream() {
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
      console.log("Local stream stopped and cleaned up.");
    }
  }
}
