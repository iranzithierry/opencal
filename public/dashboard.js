// const host = window.location.origin;
// const socket = io(host, {
//   query: { clientType: "developer" },
// });

// let myID = "";
// let targetUserID = ""; // The User ID the developer is currently calling or in call with
// let callOngoing = false;
// let localStream = null;
// let peerConnection = null;
// let callStartTime = null;
// let callTimerInterval = null;

// const myIdElement = document.getElementById("myID");
// const userTableBody = document.getElementById("userListBody");
// const ongoingCallSection = document.getElementById("ongoingCallSection");
// const callStatusElement = document.getElementById("callStatus");
// const hangUpButton = document.getElementById("hangUpButton");
// const notificationElement = document.getElementById("notification");

// // Request microphone on demand
// async function getLocalAudioStream() {
//   if (localStream) return localStream;
//   try {
//     localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
//     return localStream;
//   } catch (error) {
//     console.error("Error accessing media devices.", error);
//     notificationElement.textContent = "Error: Could not access microphone.";
//     throw error; // Re-throw to prevent call proceeding
//   }
// }

// // Initialize or reinitialize the peer connection
// function initPeerConnection() {
//   if (peerConnection) {
//     peerConnection.close(); // Clean up previous connection if any
//   }
//   peerConnection = new RTCPeerConnection({
//     iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
//   });

//   // Add local tracks if stream exists
//   if (localStream) {
//     localStream.getTracks().forEach((track) => {
//       // Check if track is already added to prevent errors
//       if (!peerConnection.getSenders().find((sender) => sender.track === track)) {
//         peerConnection.addTrack(track, localStream);
//       }
//     });
//   }

//   peerConnection.onicecandidate = (event) => {
//     // Only send candidate if we have a target and the candidate exists
//     if (event.candidate && targetUserID) {
//       socket.emit("ice-candidate", {
//         to: targetUserID,
//         candidate: event.candidate,
//       });
//     }
//   };

//   // Handle incoming remote track
//   peerConnection.ontrack = (event) => {
//     console.log("Remote track received");
//     const remoteAudio = new Audio();
//     remoteAudio.srcObject = event.streams[0];
//     remoteAudio.play().catch((e) => console.error("Audio play failed:", e)); // Handle autoplay policy
//     // Attach to DOM if needed for controls, or just play
//   };

//   peerConnection.onconnectionstatechange = () => {
//     console.log("Peer Connection State:", peerConnection.connectionState);
//     if (
//       peerConnection.connectionState === "disconnected" ||
//       peerConnection.connectionState === "failed" ||
//       peerConnection.connectionState === "closed"
//     ) {
//       if (callOngoing) {
//         // Prevent cleanup if call already ended manually
//         console.log("Peer connection lost.");
//         notificationElement.textContent = `Connection with ${targetUserID} lost.`;
//         hangUpCall(false); // Clean up without sending hangup signal again
//       }
//     }
//   };
// }

// // Display developer's unique ID
// socket.on("yourID", (id) => {
//   myID = id;
//   myIdElement.textContent = id;
// });

// // Update the list of connected users shown on the dashboard
// socket.on("update-dashboard-users", (users) => {
//   console.log("Received user list update:", users);
//   userTableBody.innerHTML = ""; // Clear existing list
//   users.forEach((user) => {
//     const row = userTableBody.insertRow();
//     row.insertCell(0).textContent = user.id;
//     row.insertCell(1).textContent = user.ip || "N/A"; // Display IP
//     const statusCell = row.insertCell(2);
//     statusCell.textContent = user.status;
//     statusCell.className = user.status === "available" ? "status-available" : "status-busy"; // Add class for styling

//     const actionCell = row.insertCell(3);
//     const callButton = document.createElement("button");
//     callButton.textContent = "Call";
//     callButton.className = "call-btn";
//     callButton.dataset.userId = user.id; // Store user ID on the button
//     // Disable button if user is busy OR if developer is already in a call
//     callButton.disabled = user.status === "busy" || callOngoing;
//     callButton.onclick = () => initiateCall(user.id); // Add click handler
//     actionCell.appendChild(callButton);
//   });

//   // Re-disable call buttons if developer is busy (in case update comes during a call)
//   if (callOngoing) {
//     document.querySelectorAll(".call-btn").forEach((btn) => (btn.disabled = true));
//   }
// });

// // Function to initiate call when developer clicks "Call"
// async function initiateCall(userIdToCall) {
//   if (callOngoing) {
//     notificationElement.textContent = "You are already in a call.";
//     return;
//   }
//   if (userIdToCall === myID) {
//     notificationElement.textContent = "You cannot call yourself.";
//     return;
//   }

//   targetUserID = userIdToCall;
//   notificationElement.textContent = `Attempting to call ${targetUserID}...`;

//   try {
//     await getLocalAudioStream(); // Get microphone access first
//     initPeerConnection(); // Setup peer connection *after* getting stream

//     const offer = await peerConnection.createOffer();
//     await peerConnection.setLocalDescription(offer);

//     socket.emit("call-user", { offer, to: targetUserID });
//     console.log(`Sent call offer to ${targetUserID}`);

//     // Disable all call buttons while attempting call
//     document.querySelectorAll(".call-btn").forEach((btn) => (btn.disabled = true));
//   } catch (error) {
//     console.error("Failed to initiate call:", error);
//     notificationElement.textContent = `Failed to initiate call to ${targetUserID}. ${
//       error.message || ""
//     }`;
//     targetUserID = ""; // Reset target
//     // Re-enable call buttons if failed before connection established
//     document.querySelectorAll(".call-btn").forEach((btn) => {
//       const btnUserId = btn.dataset.userId;
//       const userRow = document
//         .querySelector(`#userListBody tr > td:first-child:contains('${btnUserId}')`)
//         ?.closest("tr");
//       const userStatus = userRow?.querySelector(".status-available, .status-busy")?.textContent;
//       if (userStatus === "available") {
//         btn.disabled = false;
//       }
//     });
//   }
// }

// // Handle the answer when the user accepts the call
// socket.on("answer-made", async (data) => {
//   if (data.from !== targetUserID) {
//     console.warn(`Received answer from unexpected user ${data.from}, expected ${targetUserID}`);
//     return; // Ignore if answer isn't from the user we called
//   }
//   console.log(`Received answer from ${data.from}`);
//   try {
//     await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
//     console.log("Remote description set. Call established.");
//     callOngoing = true;
//     callStartTime = Date.now();
//     showOngoingCallUI();
//     startCallTimer();
//     notificationElement.textContent = ""; // Clear status message
//     // Ensure all call buttons remain disabled
//     document.querySelectorAll(".call-btn").forEach((btn) => (btn.disabled = true));
//   } catch (error) {
//     console.error("Error setting remote description:", error);
//     notificationElement.textContent = `Error establishing call with ${targetUserID}.`;
//     hangUpCall(); // Clean up if setting remote description fails
//   }
// });

// // Handle ICE candidates from the user
// socket.on("ice-candidate", (data) => {
//   if (data.from !== targetUserID) return; // Only process candidates from the current peer
//   try {
//     const candidate = new RTCIceCandidate(data.candidate);
//     peerConnection
//       .addIceCandidate(candidate)
//       .catch((e) => console.error("Error adding ICE candidate:", e));
//   } catch (e) {
//     console.error("Error creating ICE candidate:", e);
//   }
// });

// // Handle call denial by the user
// socket.on("call-denied", (data) => {
//   if (data.from === targetUserID) {
//     notificationElement.textContent = `User ${targetUserID} denied your call.`;
//     resetCallState();
//   }
// });

// // Handle user busy signal from server
// socket.on("user-busy", (data) => {
//   if (data.to === targetUserID) {
//     // Ensure it's about the user we tried to call
//     notificationElement.textContent = `User ${targetUserID} is currently busy.`;
//     resetCallState();
//   }
// });

// // Handle server error messages
// socket.on("error-message", (data) => {
//   notificationElement.textContent = `Server Error: ${data.message}`;
//   // Potentially reset state if error is related to call attempt
//   if (targetUserID && !callOngoing) {
//     resetCallState();
//   }
// });

// // Handle hangup signal from the user or due to disconnection
// socket.on("hangup-call", (data) => {
//   if (data.from === targetUserID && callOngoing) {
//     // Check if hangup is from the current peer
//     notificationElement.textContent = `Call with ${targetUserID} ended by them${
//       data.reason === "disconnected" ? " (disconnected)" : ""
//     }.`;
//     hangUpCall(false); // Clean up locally, don't emit hangup again
//   }
// });

// // ------------- Call Timer & UI -------------
// function startCallTimer() {
//   stopCallTimer(); // Clear any existing timer
//   callTimerInterval = setInterval(() => {
//     let elapsed = Date.now() - callStartTime;
//     let seconds = Math.floor((elapsed / 1000) % 60);
//     let minutes = Math.floor((elapsed / 1000 / 60) % 60);
//     let hours = Math.floor(elapsed / 1000 / 3600);
//     let formattedTime = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(
//       2,
//       "0"
//     )}:${String(seconds).padStart(2, "0")}`;
//     callStatusElement.textContent = `Ongoing call with User ${targetUserID} - Duration: ${formattedTime}`;
//   }, 1000);
// }

// function stopCallTimer() {
//   clearInterval(callTimerInterval);
//   callTimerInterval = null;
// }

// function showOngoingCallUI() {
//   ongoingCallSection.style.display = "block";
//   callStatusElement.textContent = `Connecting to ${targetUserID}...`; // Initial status
// }

// function hideOngoingCallUI() {
//   ongoingCallSection.style.display = "none";
//   callStatusElement.textContent = "No active call.";
// }

// function cleanupLocalStream() {
//   if (localStream) {
//     localStream.getTracks().forEach((track) => track.stop());
//     localStream = null;
//     console.log("Local stream stopped.");
//   }
// }

// // Function to reset state after call ends or fails before starting
// function resetCallState() {
//   targetUserID = "";
//   callOngoing = false;
//   callStartTime = null;
//   stopCallTimer();
//   if (peerConnection) {
//     peerConnection.close();
//     peerConnection = null;
//   }
//   cleanupLocalStream();
//   hideOngoingCallUI();
//   // Re-enable call buttons for available users
//   document.querySelectorAll(".call-btn").forEach((btn) => {
//     const btnUserId = btn.dataset.userId;
//     // Find the row corresponding to this button's user ID
//     // This requires a way to map userId back to the table row, e.g., searching the table
//     const userRow = Array.from(userTableBody.rows).find(
//       (row) => row.cells[0].textContent === btnUserId
//     );
//     if (userRow) {
//       const userStatus = userRow.cells[2].textContent;
//       btn.disabled = userStatus === "busy"; // Only enable if user is available
//     } else {
//       btn.disabled = false; // Default if row not found (shouldn't happen often)
//     }
//   });
//   console.log("Call state reset.");
// }

// // Hang Up button click handler
// hangUpButton.onclick = () => {
//   if (confirm("Are you sure you want to hang up?")) {
//     hangUpCall(true); // Send hangup signal to peer
//   }
// };

// // General hangup function
// function hangUpCall(notifyPeer = true) {
//   console.log(`Hanging up call with ${targetUserID}. Notify peer: ${notifyPeer}`);
//   if (notifyPeer && targetUserID) {
//     socket.emit("hangup-call", { to: targetUserID });
//   }

//   if (!callOngoing && !targetUserID) {
//     // Avoid resetting if already reset
//     console.log("Hangup called but no active call or target.");
//     return;
//   }

//   callStatusElement.textContent = "Call ended.";
//   setTimeout(() => {
//     // Keep message briefly
//     resetCallState();
//     notificationElement.textContent = ""; // Clear any previous notifications
//   }, 1500);
// }

// // Initial peer connection setup (without stream initially)
// initPeerConnection();
