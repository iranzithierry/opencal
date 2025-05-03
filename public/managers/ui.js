export class UIManager {
  constructor() {
    this.elements = {};
    this.injectCSS();
    this.injectHTML();
    this._cacheElements();
    console.log("UIManager initialized.");
  }

  injectCSS() {
    const style = document.createElement("style");
    style.id = "oc-embed-styles";
    style.textContent = `
                /* Minimal styling for the embedded client */
                #oc-callModal { display: none; position: fixed; bottom: 20px; right: 20px; width: 300px; background-color: white; border: 1px solid #ccc; box-shadow: 0 4px 8px rgba(0,0,0,0.2); border-radius: 8px; z-index: 1000; overflow: hidden; font-family: sans-serif; }
                #oc-callModalContent { padding: 20px; text-align: center; }
                #oc-callModalContent p { margin: 0 0 15px 0; font-size: 1.1em; }
                #oc-callModalContent button { margin: 5px; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; font-size: 1em; }
                #oc-acceptCall { background-color: #4CAF50; color: white; }
                #oc-denyCall { background-color: #f44336; color: white; }
                #oc-ongoingCallIndicator { display: none; position: fixed; bottom: 20px; right: 20px; background-color: #e7f3e7; border: 1px solid #4CAF50; padding: 10px 15px; border-radius: 5px; z-index: 1001; font-size: 0.9em; box-shadow: 0 2px 4px rgba(0,0,0,0.1); font-family: sans-serif; }
                #oc-ongoingCallIndicator span { margin-right: 10px; }
                #oc-ongoingCallIndicator button { margin-left: 10px; padding: 3px 8px; background-color: #f44336; color: white; border: none; border-radius: 3px; cursor: pointer; font-size: 0.8em; }
                #oc-debugInfo { font-size: 0.8em; color: #aaa; position: fixed; top: 5px; left: 5px; background: rgba(255,255,255,0.8); padding: 2px 5px; border-radius: 3px; z-index: 999; font-family: sans-serif; }
            `;
    document.head.appendChild(style);
    console.log("CSS Injected.");
  }

  injectHTML() {
    const container = document.createElement("div");
    container.id = "oc-embed-container";
    container.innerHTML = `
                <p id="oc-debugInfo">Conn ID: <span id="oc-myID">...</span></p>
                <div id="oc-callModal">
                    <div id="oc-callModalContent">
                        <p id="oc-incomingCallMessage">Incoming call...</p>
                        <button id="oc-acceptCall">Accept</button>
                        <button id="oc-denyCall">Deny</button>
                    </div>
                </div>
                <div id="oc-ongoingCallIndicator">
                    <span>Call in progress...</span>
                    <button id="oc-hangUpIndicatorButton">End Call</button>
                </div>
            `;
    document.body.appendChild(container);
    console.log("HTML Injected.");
  }

  _cacheElements() {
    this.elements.myIdElement = document.getElementById("oc-myID");
    this.elements.callModal = document.getElementById("oc-callModal");
    this.elements.incomingCallMessage = document.getElementById("oc-incomingCallMessage");
    this.elements.acceptCallButton = document.getElementById("oc-acceptCall");
    this.elements.denyCallButton = document.getElementById("oc-denyCall");
    this.elements.ongoingCallIndicator = document.getElementById("oc-ongoingCallIndicator");
    this.elements.hangUpIndicatorButton = document.getElementById("oc-hangUpIndicatorButton");
    this.elements.debugInfo = document.getElementById("oc-debugInfo");
  }

  showCallModal(fromId) {
    if (this.elements.incomingCallMessage)
      this.elements.incomingCallMessage.textContent = `Incoming call...`; // Don't show ID
    if (this.elements.callModal) this.elements.callModal.style.display = "block";
  }

  hideCallModal() {
    if (this.elements.callModal) this.elements.callModal.style.display = "none";
  }

  showOngoingCallIndicator() {
    if (this.elements.ongoingCallIndicator)
      this.elements.ongoingCallIndicator.style.display = "block";
    this.hideCallModal(); // Ensure modal is hidden
  }

  hideOngoingCallIndicator() {
    if (this.elements.ongoingCallIndicator)
      this.elements.ongoingCallIndicator.style.display = "none";
  }

  updateMyID(id) {
    if (this.elements.myIdElement) this.elements.myIdElement.textContent = id;
  }

  resetUI() {
    this.hideCallModal();
    this.hideOngoingCallIndicator();
    if (this.elements.myIdElement) this.elements.myIdElement.textContent = "...";
    if (this.elements.debugInfo) this.elements.debugInfo.style.color = "#aaa";
  }

  showStatusMessage(message, isError = false) {
    if (this.elements.debugInfo) {
      this.elements.debugInfo.textContent = message;
      this.elements.debugInfo.style.color = isError ? "red" : "#aaa";
    }
    // Optionally clear after a delay
    setTimeout(() => {
      if (this.elements.myIdElement?.textContent !== "...") {
        // Don't clear if ID is shown
        if (this.elements.debugInfo)
          this.elements.debugInfo.innerHTML = `Conn ID: <span id="oc-myID">${this.elements.myIdElement.textContent}</span>`;
      } else if (this.elements.debugInfo) {
        this.elements.debugInfo.innerHTML = `Conn ID: <span id="oc-myID">...</span>`;
      }
      if (this.elements.debugInfo) this.elements.debugInfo.style.color = "#aaa";
    }, 5000); // Clear after 5 seconds
  }

  setupEventHandlers(controller) {
    this.elements.acceptCallButton?.addEventListener("click", () => controller.acceptCall());
    this.elements.denyCallButton?.addEventListener("click", () => controller.denyCall());
    this.elements.hangUpIndicatorButton?.addEventListener("click", () => {
      if (confirm("End the current call?")) {
        controller.hangUpCall(true);
      }
    });
  }
}
