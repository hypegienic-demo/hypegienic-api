// import * as Discord from 'discord.js'
// import fetch from 'node-fetch'
// import {createCanvas, loadImage} from 'canvas'

// import {ChatbotUtility} from '../'
// import {PersistedRequest} from '../../persistence/request'
// import {canvasStyle, alignCenterImage} from '../utility/canvas'

// export const displayStatus = (status:PersistedRequest['status']) =>
//   status.split('-').map(word => word[0].toUpperCase() + word.slice(1)).join(' ')
// export const displayRequest = async(
//   utilities: ChatbotUtility,
//   channel: Discord.TextChannel | Discord.DMChannel | Discord.NewsChannel,
//   selectedRequest: PersistedRequest
// ) => {
//   const {
//     spacesAPI,
//     userPersistence,
//     lockerPersistence,
//     requestPersistence,
//     filePersistence
//   } = utilities
//   const [activeLocker, orderer, events] = await Promise.all([
//     (async() => {
//       if(selectedRequest.type === 'locker') {
//         switch(selectedRequest.status) {
//           case 'delivered-locker':
//           case 'retrieved': {
//             const lockerUnit = await lockerPersistence.getLockerUnit({
//               lockerUnitId: selectedRequest.lockerUnitDelivered
//             })
//             return await lockerPersistence.getLocker({lockerId:lockerUnit.locker})
//           }
//           default: {
//             const lockerUnit = await lockerPersistence.getLockerUnit({
//               lockerUnitId: selectedRequest.lockerUnitOpened
//             })
//             return await lockerPersistence.getLocker({lockerId:lockerUnit.locker})
//           }
//         }
//       } else {
//         return undefined
//       }
//     })(),
//     userPersistence.getUser({userId:selectedRequest.orderer}),
//     requestPersistence.getRequestEvents({
//       requestId: selectedRequest.id
//     })
//   ])
//   const imageCanvas = createCanvas(1098, 628)
//   const imageContext = imageCanvas.getContext('2d')
//   imageContext.font = canvasStyle.font(32)
//   imageContext.fillStyle = canvasStyle.textColor(1)
//   switch(selectedRequest.status) {
//     case 'delivered-store':
//     case 'cleaned':
//     case 'delivered-locker':
//     case 'retrieved': {
//       const imagesBefore = await filePersistence.getFiles({
//         fileIds: selectedRequest.imagesBefore
//       })
//       const images = await Promise.all(imagesBefore.map(async image => {
//         const url = spacesAPI.retrieveFile(image)
//         if(url) {
//           const file = await fetch(url, {method:'GET'})
//             .then(response => response.buffer())
//           return await loadImage(file)
//         }
//       })).then(images =>
//         images.flatMap(image => image? [image]:[])
//       )
//       imageContext.fillText('Before', 16, 48)
//       images.slice(0, 3).forEach((image, index) =>
//         imageContext.drawImage(
//           ...alignCenterImage(image, {width:350, height:250}, {x:191 + 358 * index, y:181})
//         )
//       )
//     }
//   }
//   switch(selectedRequest.status) {
//     case 'cleaned':
//     case 'delivered-locker':
//     case 'retrieved': {
//       const imagesAfter = await filePersistence.getFiles({
//         fileIds: selectedRequest.imagesAfter
//       })
//       const images = await Promise.all(imagesAfter.map(async image => {
//         const url = spacesAPI.retrieveFile(image)
//         if(url) {
//           const file = await fetch(url, {method:'GET'})
//             .then(response => response.buffer())
//           return await loadImage(file)
//         }
//       })).then(images =>
//         images.flatMap(image => image? [image]:[])
//       )
//       imageContext.fillText('After', 16, 354)
//       images.slice(0, 3).forEach((image, index) =>
//         imageContext.drawImage(
//           ...alignCenterImage(image, {width:350, height:250}, {x:191 + 358 * index, y:487})
//         )
//       )
//     }
//   }
//   const image = imageCanvas.toBuffer()
//   channel.send({
//     embed: {
//       title: selectedRequest.name,
//       description: [
//         activeLocker? `**location** ${activeLocker.name}`:undefined,
//         `**status** ${displayStatus(selectedRequest.status)}`,
//         `**customer** ${orderer.displayName}`,
//         `**updated** ${selectedRequest.time.toDateString()}`
//       ].filter(field => !!field).join('\n'),
//       fields: [{
//         name: 'History',
//         value: events
//           .sort((event1, event2) => event1.time.getTime() - event2.time.getTime())
//           .map((event, index) =>
//             `*${index + 1}.* ${displayStatus(event._status as PersistedRequest['status'])} ` +
//             `*${event.time.toTimeString().split(' ')[0]}, ${event.time.toDateString()}*`
//           )
//       }],
//       image: {
//         url: 'attachment://image.png'
//       }
//     },
//     files: [
//       {name:'image.png', attachment:image}
//     ]
//   })
// }