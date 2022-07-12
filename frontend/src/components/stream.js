/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable jsx-a11y/anchor-is-valid */
import React, { useRef, useState, useEffect } from 'react';
import './stream.style.scss'


const sleep = (milliseconds) => {
   return new Promise(resolve => setTimeout(resolve, milliseconds))
}

function Streampage() {

   let stream = useRef();
   // available devices list
   const [devices, setDevices] = useState({ videoInputs: [], audioInputs: [] })
   const [selectedVideoInputDeviceId, setSelectedVideoInputDeviceId] = useState('');
   const [selectedAudioInputDeviceId, setSelectedAudioInputDeviceId] = useState('');

   const [status, setStatus] = useState({ isConnecting: false, isStreaming: false })
   const [errorMSG, setErrorMSG] = useState(null);
   const [debugMSG, setdebugMSG] = useState(null);

   const wsRef = useRef();
   const mediaRecorder = useRef();
   const constraints = {
      audio: { autoplay: true, deviceId: selectedAudioInputDeviceId },
      video: { width: 1280, height: 720, deviceId: selectedVideoInputDeviceId },
   };
   const rtmpURL = process.env.REACT_APP_RTMP_URL;
   const streamKey = process.env.REACT_APP_STREAM_KEY;
   const playURL = process.env.REACT_APP_PLAY_URL;
   const webSocketUrl = process.env.REACT_APP_WEBSOCKET_URL;

   useEffect(() => {
      (async function() {
         // C1 - init CAM
         let hasError = false;
         try {
            await navigator.mediaDevices.getUserMedia(constraints);
         } catch (e) {
            handleError(e);
            hasError = true;
         } finally {
            if(!hasError) {
               try {
                  const availableDevices = await navigator.mediaDevices.enumerateDevices()
                  handleList(availableDevices);
               } catch (e) {
                  handleError(e);
               }
            }
         }
      })();
   }, []);

   useEffect(() => {
      enableCam();
   }, [selectedVideoInputDeviceId, selectedAudioInputDeviceId]);

   // C2 - list Cameras
   const handleList = (availableDevices) => {
      let videoInputs = [];
      let audioInputs = [];
      let audioOutputs = [];
      availableDevices.forEach((device) => {
         let i = 0;
         if(device.kind === 'audioinput'){
            audioInputs.push({ label: device.label, id: device.deviceId, len: i++ })
         } else if(device.kind === 'videoinput'){
            videoInputs.push({ label: device.label, id: device.deviceId })
         } else if(device.kind === 'audiooutput'){
            audioOutputs.push({ label: device.label, id: device.deviceId })
         }
      })
      setDevices({ audioInputs, videoInputs, audioOutputs });
   }
   // C3 enable camera
   const enableCam = async () => {
      await navigator.mediaDevices.getUserMedia(
         constraints
      ).then((mediaStream) => {
         stream.current = mediaStream
         const usedDevicesMap = {};
         mediaStream.getTracks()
            .forEach((track) => {
               usedDevicesMap[track.kind] = track.getSettings().deviceId
            });
         setSelectedVideoInputDeviceId(usedDevicesMap['video']);
         setSelectedAudioInputDeviceId(usedDevicesMap['audio']);
         const videoElement = document.querySelector('video');
         videoElement.srcObject = mediaStream;
         videoElement.onloadedmetadata = async function(e) {
            await videoElement.play();
         };
      }).catch(error =>  {
         console.error("Error in EnCam", error);
         handleError(error);
      });
   };

   // C2.1 In case error to enable cam
   const handleError = (error) => {
      const errorName = error.name;
      let errorMessage = errorName;
      switch (errorName) {
         case 'ConstraintNotSatisfiedError': {
            const v = constraints.video;
            errorMessage = `${ errorName }: The resolution ${ v.width.exact }x${ v.height.exact } px is not supported by your device.`;
            break;
         }
         case 'NotAllowedError': {
            errorMessage = errorName + ': Permissions have not been granted to use your camera and ' +
    'microphone, you need to allow the page access to your devices in ' +
    'order for the demo to work.';
            break;
         }
         default: {}
      }
      setErrorMSG(errorMessage);
   }

   // C5 handle device change
   const handleDevChange = event => {
      /// if audio if video
      event.preventDefault();
      if(event.target.id === 'videoInputs'){
         setSelectedVideoInputDeviceId(event.target.value);
      }
      if(event.target.id === 'audioInputs'){
         setSelectedAudioInputDeviceId(event.target.value);
      }
   };

   // S2 - Stop streaming to IVS
   const stopStreaming = () => {
      if(mediaRecorder.current.state === 'recording') {
         mediaRecorder.current.stop();
         wsRef.current.close();
      }
      setStatus({ isConnecting: false, isStreaming: false })
      setdebugMSG(null)
   };

   //S1 - Start streaming to IVS
   const startStreaming = async (e) => {
      e.preventDefault();
      let wsUrl = `${ webSocketUrl }/rtmps/${ rtmpURL }${ streamKey }`;
      wsRef.current = new WebSocket(wsUrl);
      wsRef.current.onerror = err => {
         console.error("Got a error!!!", err, wsRef.current)
      }

      wsRef.current.onclose = e => {
         console.log("Fallback 1",  e.reason)
      }

      wsRef.current.onmessage = evt => {
         setdebugMSG(evt.data)
      }

      wsRef.current.addEventListener('open', async function open(data) {
         console.log("Open!!!", data)
         setStatus({ isConnecting: true })
         if(data){
            console.log("!@@@@!!!")
            await sleep(15000);
            setStatus({ isConnecting: false, isStreaming: true })
         }
      });
      let mimeType = 'video/webm';
      if(!MediaRecorder.isTypeSupported(mimeType)) {
         mimeType = 'video/mp4';
      }
      mediaRecorder.current = new MediaRecorder(stream.current, {
         mimeType,
         videoBitsPerSecond: 3000000,
      });
      mediaRecorder.current.addEventListener('dataavailable', (e) => {
         wsRef.current.send(e.data);
      });
      mediaRecorder.current.start(1000);
   }

   document.body.style = 'background: #262626;';

   return (
      <div className='App'>
         <div className='container-fluid'>
            <h1>Simple Streaming</h1>
            {errorMSG && (
               <div className='errorMSG'>
                  <p>Please enable your Camera, check browser Permissions.</p>
                  <p>Error: {errorMSG}</p>
               </div>
            )}
            <div className='container-fluid'>
               <div className='row'>
                  <div className='col-lg-12'>
                     {
                        devices.videoInputs.length && (
                           <form className='form-control-select'>
                              <select
                                 id='videoInputs'
                                 className='form-control'
                                 onChange={ handleDevChange }
                                 value={ selectedVideoInputDeviceId }
                              >
                                 <option disabled>Select Camera</option>
                                 {devices.videoInputs.map((videoInputs) =>
                                    <option key={ videoInputs.id } value={ videoInputs.id }>{videoInputs.label}</option>)}
                              </select>
                              <select
                                 id='audioInputs'
                                 className='form-control'
                                 onChange={ handleDevChange }
                                 value={ selectedAudioInputDeviceId }
                              >
                                 <option disabled>Select Audio In</option>
                                 {devices.audioInputs.map((audioInputs) =>
                                    <option key={ audioInputs.id } value={ audioInputs.id }>{audioInputs.label}</option>)}
                              </select>
                           </form>
                        )
                     }

                  </div>
               </div>
               <div className='row'>

                  <div className='col-lg-12'>
                     <div className='webcamBOX'>
                        <video autoPlay={ true } muted={ true } id='videoElement' controls></video>
                     </div>
                  </div>

               </div>
            </div>
            <div className='row'>

               {!status.isStreaming && (
                  <div className='form-group'>
                     <form className='form-URL'>
                        {!status.isConnecting && (
                           <div className='formLabel'>
                              <button type='submit' className='formBot' onClick={ startStreaming }>GoLive!</button>
                           </div>
                        )}
                        {status.isConnecting && (
                           <div className='formLabel'>
                              <button disabled className='formBotConecting'>Connecting (Sleeping for 15 seconds)</button>
                           </div>
                        )}

                     </form>
                  </div>
               )}
               {status.isStreaming && (
                  <div className='form-group'>
                     <button type='submit' className='formBotStop' onClick={ stopStreaming }>StopStreaming!</button>
                     <br></br>
                     <button className='formBot' onClick={ () => {
                        window.open('https://live.amstest.net');
                     } }>View live stream</button>
                  </div>
               )}
            </div>
            <div className='DebugBOXger'>
               <div className='DebugBOXtitle'>
                  <a>Info:</a>
               </div>
               <div className='DebugBOX'>
                  <table className='DebugTable'>
                     <tbody>
                        <tr>
                           <th width={ 100 }>Play URL:</th>
                           <td>{playURL}</td>
                        </tr>
                        <tr>
                           <th>isLive:</th>
                           <td>{String(status.isStreaming)}</td>
                        </tr>
                        <tr>
                           <th>Debug MSG:</th>
                           <td>{String(debugMSG)}</td>
                        </tr>
                     </tbody>
                  </table>
               </div>
            </div>


         </div>
      </div>
   )
}
export default Streampage;
