(function () {
  "use strict";

  let code = 111111111;

  const MESSAGE_TYPE = {
    SDP: 'SDP',
    CANDIDATE: 'CANDIDATE',
  }

  $(document).ready(function() {
    $("#start-button").click(function() {
      startChat();
    });
  });

  const startChat = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });

      const signaling = new WebSocket('ws://127.0.0.1:1337');
      const peerConnection = createPeerConnection(signaling);

      addMessageHandler(signaling, peerConnection);

      stream.getTracks().forEach(track => peerConnection.addTrack(track, stream));
      document.getElementById('self-view').srcObject = stream;

      $("#stop-button").click(function() {
        stopChat(signaling, stream, peerConnection);
      });

    } catch (err) {
      console.error(err);
    }
  };

  const stopChat = async (signaling, stream, peerConnection) => {
    try {
      console.log('stop chat');
      signaling.close();
      peerConnection.close();
    } catch (err) {
      console.error(err);
    }
  };

  const createPeerConnection = (signaling) => {
    const peerConnection = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.test.com:19000' }],
    });
    
    peerConnection.onnegotiationneeded = async () => {
      await createAndSendOffer(signaling, peerConnection);
    };

    peerConnection.onicecandidate = (iceEvent) => {
      if (iceEvent && iceEvent.candidate) {
        sendMessage(signaling, {
          message_type: MESSAGE_TYPE.CANDIDATE,
          content: iceEvent.candidate,
        });
      }
    };

    peerConnection.ontrack = (event) => {
      const video = document.getElementById('remote-view');
      
      if (!video.srcObject) {
        video.srcObject = event.streams[0];
      }
    };

    peerConnection.onclose = function () {
      console.log("datachannel close");
    };
    
    return peerConnection;
  }

  const addMessageHandler = (signaling, peerConnection) => {
    signaling.onmessage = async (message) => {
      const data = JSON.parse(message.data);

      if (!data) {
        return;
      }

      const { message_type, content } = data;
      try {
        if (message_type === MESSAGE_TYPE.CANDIDATE && content) {
          await peerConnection.addIceCandidate(content);
        } else if (message_type === MESSAGE_TYPE.SDP) {
          if (content.type === 'offer') {
            await peerConnection.setRemoteDescription(content);
            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);
            sendMessage(signaling, {
              message_type: MESSAGE_TYPE.SDP,
              content: answer,
            });
          } else if (content.type === 'answer') {
            await peerConnection.setRemoteDescription(content);
          } else {
            console.log('Unsupported SDP type.');
          }
        }
      } catch (err) {
        console.error(err);
      }
    };
  };

  const sendMessage = (signaling, message) => {
    if (code) {
      signaling.send(JSON.stringify({
        ...message,
        code,
      }));
    }
  };

  const createAndSendOffer = async (signaling, peerConnection) => {
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    sendMessage(signaling, {
      message_type: MESSAGE_TYPE.SDP,
      content: offer,
    });
  };
})();