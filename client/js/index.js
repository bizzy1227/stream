(function () {
    "use strict";

    let code = 111111111;

    const MESSAGE_TYPE = {
        SDP: 'SDP',
        CANDIDATE: 'CANDIDATE',
    }

    let stream = null;

    let signaling = null;
    let peerConnection = null;

    $(document).ready(function () {
        $('#start-button').click(async function () {
          startChat();
        });

        $('#next-button').click(async function () {
          stopChat(signaling, peerConnection);
          startChat();
        });

        $('.gender-selector__button').click(function () {
          $('.gender-selector__popup').addClass('visible');
        });

        $('.gender-selector__popup-item').click(function () {
          $('.gender-selector__popup').removeClass('visible');
          let newGender = $(this).find('img');
          const currentGender = $('.selected-value');
          currentGender.find('img').remove();
          $(newGender).clone().appendTo(currentGender);
          console.log($(currentGender).find('img').attr('id'));
        });

        $('.country-filter').click(function () {
          $('.country-filter-popup').addClass('visible');
        });

        $('.country-filter-popup__country').click(function () {
          $('.country-filter-popup').removeClass('visible');
          let newCountry = $(this).attr('data-country');
          console.log(newCountry);
          const currentCountry = $('.country');
          currentCountry.text(newCountry);
        });
        
    });

    const postData = async (data) => {
      return $.ajax({
        type: "POST",
        url: "/api/start_call",
        data: JSON.stringify(data),
        contentType: "application/json; charset=utf-8",
        crossDomain: true,
        dataType: "json",
        success: function (data, status, jqXHR) {
            console.log('success');
        },
        error: function (jqXHR, status) {
            console.log(jqXHR);
            console.log('fail', status.code);
        }
      });
    };

    const startChat = async () => {
        const data = {
          code: code,
          county: $('.country').text(),
          gender: $('.selected-value > img').attr('id')
        }
        console.log('data', data);
        $('#remote-view').attr('poster', 'images/noice.gif');
        // const postResult = await postData(data);
        $('#start-button').css('display', 'none');
        $('#next-button').css('display', 'block');
        $('#stop-button').removeClass('disabled');
        $('.wrap-not-found-users-message').css('display', 'block');
        try {
            stream = await navigator.mediaDevices.getUserMedia({audio: true, video: true});

            signaling = new WebSocket('ws://localhost:1337');
            peerConnection = createPeerConnection(signaling);

            addMessageHandler(signaling, peerConnection);

            stream.getTracks().forEach(track => peerConnection.addTrack(track, stream));
            document.getElementById('self-view').srcObject = stream;

            $('#stop-button').click(function () {
                stopChat(signaling, peerConnection);
            });

        } catch (err) {
            console.error(err);
        }
    };

    const stopChat = async (signaling, peerConnection) => {
        $('#start-button').css('display', 'block');
        $('#next-button').css('display', 'none');
        $('#stop-button').addClass('disabled');
        $('#remote-view').attr('poster', '');
        $('.wrap-not-found-users-message').css('display', 'none');
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
            iceServers: [{urls: 'stun:stun.l.test.com:19000'}],
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
              $('.wrap-not-found-users-message').css('display', 'none');
              video.srcObject = event.streams[0];
            }
        };

        peerConnection.onclose = function () {
            console.log('datachannel close');
        };

        return peerConnection;
    }

    const addMessageHandler = (signaling, peerConnection) => {
        signaling.onmessage = async (message) => {
            const data = JSON.parse(message.data);

            if (!data) {
                return;
            }

            const {message_type, content} = data;
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
