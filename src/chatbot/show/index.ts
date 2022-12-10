// import * as Discord from 'discord.js'

// import {PersistedRequest} from '../../persistence/request'
// import {PersistedLocker} from '../../persistence/locker'
// import {conjuctJoin} from '../../utility/string'
// import {emojiSelect} from '../utility/select'
// import {Method} from '../'
// import {displayStatus, displayRequest} from './display'

// type DiscordChannel = Discord.TextChannel | Discord.DMChannel | Discord.NewsChannel
// const statuses:PersistedRequest['status'][] = ['opened-locker', 'deposited', 'delivered-store', 'cleaned', 'delivered-locker']
// const method:Method = async(utilities, client, {message, argument}) => {
//   const {
//     userPersistence,
//     lockerPersistence,
//     requestPersistence
//   } = utilities
//   const [activeRequests, lockers, user] = await Promise.all([
//     requestPersistence.getRequests({statuses}),
//     lockerPersistence.getLockers(),
//     userPersistence.getUser({
//       discordId: message.author.id
//     })
//   ])
//   if(!user) {
//     message.reply("you're not permitted for this action")
//   } else if(activeRequests.length === 0) {
//     message.reply("there's no active order requests at this moment")
//   } else {
//     const filteredRequests = await filterRequests(message.channel, activeRequests, lockers)
//     const orderers = await Promise.all(filteredRequests
//       .map(request => request.orderer)
//       .filter((orderer, index, orderers) => orderers.indexOf(orderer) === index)
//       .map(userId => userPersistence.getUser({userId}))
//     )
//     const firstRequest = filteredRequests[0]
//     const locker = firstRequest.type === 'locker'
//       ? lockers.find(locker =>
//           locker.units.includes(firstRequest.lockerUnitOpened)
//         )
//       : undefined
//     const statuses = filteredRequests
//       .map(request => request.status)
//       .filter((status, index, statuses) => statuses.indexOf(status) === index)
//       .map(displayStatus)
//     const selected = await emojiSelect(
//       message.channel,
//       {
//         title: 'Order Request',
//         description: [
//           `**location** ${locker?.name}`,
//           `**status** ${conjuctJoin(statuses)}`
//         ].join('\n')
//       },
//       filteredRequests.map(request => {
//         const user = orderers.find(user => user.id === request.orderer)
//         return `${request.name} *${user?.displayName}*`
//       })
//     )
//     const selectedRequest = filteredRequests.find(request => {
//       const orderer = orderers.find(user => user.id === request.orderer)
//       return `${request.name} *${orderer?.displayName}*` === selected
//     })
//     if(selectedRequest) {
//       await displayRequest(utilities, message.channel, selectedRequest)
//     }
//   }
// }
// const filterRequests = async(channel:DiscordChannel, requests:PersistedRequest[], lockers:PersistedLocker[]):Promise<PersistedRequest[]> => {
//   const activeLockerUnitIds = requests.flatMap(request =>
//     request.status === 'delivered-locker'
//       ? request.lockerUnitDelivered
//       : request.type === 'locker'
//       ? request.lockerUnitOpened
//       : undefined
//   ).flatMap(id => !!id? [id]:[])
//   const activeLockers = lockers.filter(locker =>
//     activeLockerUnitIds.some(id => locker.units.includes(id))
//   )
//   const activeStatuses = requests
//     .map(request => request.status)
//     .filter((status, index, statuses) => statuses.indexOf(status) === index)
//   if(activeLockers.length > 1) {
//     const chosenLockerName = await emojiSelect(
//       channel,
//       {title:'Order Requests', description:'Please choose a locker below'},
//       activeLockers.map(locker => locker.name)
//     )
//     const chosenLocker = activeLockers.find(locker => locker.name === chosenLockerName)
//     const filteredRequests = requests.filter(request =>
//       request.type === 'locker' &&
//       chosenLocker?.units.includes(
//         request.status === 'delivered-locker'? request.lockerUnitDelivered:request.lockerUnitOpened
//       )
//     )
//     return filterRequests(channel, filteredRequests, lockers)
//   } else if(activeStatuses.length > 1) {
//     const chosenStatus = await emojiSelect(
//       channel,
//       {title:'Order Requests', description:'Please choose a status below'},
//       [
//         ...statuses.filter(status => activeStatuses.includes(status)).map(displayStatus),
//         'All'
//       ]
//     )
//     const filteredRequests = chosenStatus === 'All'
//       ? requests
//       : requests.filter(request => request.status === chosenStatus.replace(' ', '-').toLowerCase())
//     return filteredRequests
//   } else {
//     return requests
//   }
// }
// export default method