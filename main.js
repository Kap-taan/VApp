let APP_ID = '3452ad4fcc6d4801b7aeddc9fb191cbf';

let token = null;
let uid = String(Math.floor(Math.random() * 10000));

let client;
let channel;

let queryString = window.location.search;
let urlParams = new URLSearchParams(queryString);
let roomId = urlParams.get('room');

if(!roomId)
{
    window.location = 'lobby.html';

}

let localStream;
let remoteStream;
let peerConnection;

const servers = {
    iceServers: [
        {
            urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302']
        }
    ]
};

let init = async () => {

    client = await AgoraRTM.createInstance(APP_ID);
    await client.login({uid, token});

    // create the channel
    channel = client.createChannel(roomId);
    await channel.join();

    channel.on('MemberJoined', handleUserJoined);

    channel.on('MemberLeft', handleUserLeft);

    // Handling message from peer
    client.on('MessageFromPeer', handleMessageFromPeer);

    localStream = await navigator.mediaDevices.getUserMedia({video: true, audio: true});
    document.getElementById('user-1').srcObject = localStream;

}

const handleMessageFromPeer = async (message, MemberId) => {

    message = JSON.parse(message.text);
    if(message.type === 'offer') {
        createAnswer(MemberId, message.offer);
    }

    if(message.type === 'answer') {
        addAnswer(message.answer);   
    }

    if(message.type === 'candidate') {
        if(peerConnection) {
            peerConnection.addIceCandidate(message.candidate);
        }
    }

}

const handleUserJoined = async (MemberId) => {

    console.log('A New User has joined the channel', MemberId);
    createOffer(MemberId);

}

const handleUserLeft = () => {
    document.getElementById('user-2').style.display = 'none';
    document.getElementById('user-1').classList.remove('smallFrame');
}

let createPeerConnection = async (MemberId) => {
    peerConnection = new RTCPeerConnection(servers);

    remoteStream = new MediaStream();
    document.getElementById('user-2').srcObject = remoteStream;
    document.getElementById('user-2').style.display = 'block';
    document.getElementById('user-1').classList.add('smallFrame');


    if(!localStream) {
        localStream = await navigator.mediaDevices.getUserMedia({video: true, audio: true});
        ocument.getElementById('user-1').srcObject = localStream;
    }

    localStream.getTracks().forEach((track) => {
        peerConnection.addTrack(track, localStream);
    })

    peerConnection.ontrack = (event) => {
        event.streams[0].getTracks().forEach(track => {
            remoteStream.addTrack(track);
        })
    }

    peerConnection.onicecandidate = async (event) => {

        if(event.candidate) {
            console.log('New ICE candidate ', event.candidate);
            client.sendMessageToPeer({text: JSON.stringify({'type':'candidate', 'candidate': event.candidate})}, MemberId);
        }

    }
}

let createOffer = async (MemberId) => {

    await createPeerConnection(MemberId);

    let offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    client.sendMessageToPeer({text: JSON.stringify({'type':'offer', 'offer': offer})}, MemberId);


}

let createAnswer = async (MemberId, offer) => {

    await createPeerConnection(MemberId);
    await peerConnection.setRemoteDescription(offer);

    let answer = await peerConnection.createAnswer();

    await peerConnection.setLocalDescription(answer);

    client.sendMessageToPeer({text: JSON.stringify({'type':'answer', 'answer': answer})}, MemberId);

}

const addAnswer = async (answer) => {

    if(!peerConnection.currentRemoteDescription) {
        peerConnection.setRemoteDescription(answer);
    }

}

const leaveChannel = async () => {

    await channel.leave();
    await channel.logout();

}

const toggleCamera = async () => {

    let videoTracks =  localStream.getTracks().find(track => track.kind === 'video');
    
    if(videoTracks.enabled) {
        videoTracks.enabled = false;
        document.getElementById('camera-btn').style.backgroundColor = 'rgb(255, 80, 80)';
    } else {
        videoTracks.enabled = true;
        document.getElementById('camera-btn').style.backgroundColor = 'rgb(179, 102, 249, 0.9)';
    }

}

const toggleMic = async () => {

    let audioTrack =  localStream.getTracks().find(track => track.kind === 'audio');
    
    if(audioTrack.enabled) {
        audioTrack.enabled = false;
        document.getElementById('mic-btn').style.backgroundColor = 'rgb(255, 80, 80)';
    } else {
        audioTrack.enabled = true;
        document.getElementById('mic-btn').style.backgroundColor = 'rgb(179, 102, 249, 0.9)';
    }

}

window.addEventListener('beforeunload', leaveChannel);

document.getElementById('camera-btn').addEventListener('click', toggleCamera);
document.getElementById('mic-btn').addEventListener('click', toggleMic);

init();