import User from '../users/user'
import Message from '../models/message'
import Reaction from '../models/reaction'
import Score from '../models/score'
import config from 'config-yml'
import commands from '../commands'
import commandUtils from '../commands/commandsUtils'

export default async message => {
  const msg = await Message.findOne({ 'rocketData.messageId': message._id })
  const user = await User.findOne({ rocketId: message.u._id })

  if (isCommand(message)) return handleCommand(message, user)
  if (!msg && !message.tmid) return handleNewMessage(message, user)
  if (!msg && message.tmid) return handleReply(message, user)
  return handleReactions(message, msg)
}

const isCommand = message => {
  const commandsList = Object.values(commandUtils.getCommandsRegex())
  return commandsList.find(command => new RegExp(command).test(message.msg))
}

const handleCommand = (message, user) => {
  commands.handle(message)
  Message.create({
    user: user._id,
    'rocketData.messageId': message._id,
    'rocketData.roomId': message.rid,
    'rocketData.userId': message.u._id,
    content: message.msg,
    'is.command': true
  })
}

const handleNewMessage = async (message, user) => {
  const msg = await Message.create({
    user: user._id,
    'rocketData.messageId': message._id,
    'rocketData.roomId': message.rid,
    'rocketData.userId': message.u._id,
    content: message.msg
  })

  Score.create({
    value: config.xprules.messages.send,
    description: 'New message',
    ref: msg._id,
    refModel: 'Message'
  })
}

const handleReply = async (message, user) => {
  const parentMessage = await Message.findOne({
    'rocketData.messageId': message.tmid
  })

  const msg = await Message.create({
    user: user._id,
    'rocketData.messageId': message._id,
    'rocketData.roomId': message.rid,
    'rocketData.parent': message.tmid,
    'rocketData.userId': message.u._id,
    content: message.msg,
    parent: parentMessage._id
  })

  Score.create({
    value: config.xprules.threads.send,
    description: 'New reply sent',
    ref: msg._id,
    refModel: 'Message'
  })

  Score.create({
    value: config.xprules.threads.receive,
    description: 'New reply received',
    ref: parentMessage._id,
    refModel: 'Message'
  })

  parentMessage.is.thread = true
  parentMessage.save()
}

const handleReactions = async (message, msg) => {
  if (!message.reactions) {
    // There is no reactions for that message anymore
    // Clear all
  }
  const reactionsMatrix = createReactionsMatrixFromRocketMessage(message)
  const reactions = await Reaction.find({ message: msg._id })

  if (reactionsMatrix.length > reactions.length) {
    const subject = reactionsMatrix.filter(rm => {
      return reactions.find(r => {
        return !(rm.username === r.username && rm.content === r.content)
      })
    })

    return console.log(subject)

    const user = await User.findOne({ username: subject.username })
    const reaction = await Reaction.create({
      'rocketData.messageId': message._id,
      'rocketData.userId': user.rocketId,
      'rocketdata.username': subject.username,
      content: subject.content,
      message: msg._id
    })

    console.log(reaction)
    // Reaction was created
  } else {
    // Reaction was removed
  }
}

const createReactionsMatrixFromRocketMessage = message => {
  const { reactions } = message
  const keys = Object.keys(reactions)
  const matrix = keys.map(key => {
    return reactions[key].usernames.map(username => {
      return {
        username,
        content: key
      }
    })
  })

  return matrix.flat()
}

// {
//   ':thumbsup:': { usernames: [ 'andre-cavallari' ] },
//   ':impulso:': { usernames: [ 'teste' ] }
// }

/*
[ 
  { username: 'teste', content: ':impulso:' },
  { username: 'andre-cavallari', content: ':impulso:' },
  { username: 'andre-cavallari', content: ':thumbsup:' } 
]

*/