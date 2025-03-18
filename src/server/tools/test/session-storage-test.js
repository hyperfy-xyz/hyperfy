// import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js'
// import { Sessions } from './session-storage'

// describe(Sessions.name, () => {
//   it('should be able to add a session', () => {
//     const sessions = new Sessions()
//     const sessionId = '123'
//     const transport = fakeTransport()

//     sessions.add(sessionId, transport)

//     expect(sessions.get(sessionId)).toBe(transport)
//   })

//   it('should throw an error if adding a session that already exists', () => {
//     const sessions = new Sessions()
//     const sessionId = '123'
//     const transport = fakeTransport()

//     sessions.add(sessionId, transport)

//     expect(() => sessions.add(sessionId, transport)).toThrow('Session already exists')
//   })

//   it('should be able to remove a session', () => {
//     const sessions = new Sessions()
//     const sessionId = '123'
//     const transport = fakeTransport()

//     sessions.add(sessionId, transport)
//     sessions.remove(sessionId)

//     expect(sessions.get(sessionId)).toBeUndefined()
//   })

//   it('should not throw an error if removing a session that does not exist', () => {
//     const sessions = new Sessions()
//     const sessionId = '123'

//     expect(() => sessions.remove(sessionId)).not.toThrow()
//   })

//   it('should be able to get a session', () => {
//     const sessions = new Sessions()
//     const sessionId = '123'
//     const transport = fakeTransport()

//     sessions.add(sessionId, transport)

//     expect(sessions.get(sessionId)).toBe(transport)
//   })

//   it('should return undefined if getting a session that does not exist', () => {
//     const sessions = new Sessions()
//     const sessionId = '123'

//     expect(sessions.get(sessionId)).toBeUndefined()
//   })
// })

// function fakeTransport() {
//   return jest.fn()
// }
