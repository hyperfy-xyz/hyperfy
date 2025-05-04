# Solana

## World Token

Your world accepts deposits and withdrawals of a specific token. This is specified with the `WORLD_TOKEN_MINT_ADDRESS` in your `.env`

## World Wallet

Your world has its own wallet that deposits go into, and withdrawals come out of.

You can generate a new wallet by running `node ./scripts/gen-wallet.js` and pasting these values into your `.env`

## player.wallet

Wallet information is automatically synchronized and can be accessed by apps on both the server and client.

**player.wallet.connecting**: A boolean that determines whether their wallet is in the process of connecting.

**player.wallet.connected**: A boolean that determines whether their wallet is connected.

**player.wallet.address**: The players wallet address, when connected.

## world.on('wallet', callback)

Apps can also subscribe to global player wallet changes on both the client and server.

```jsx
world.on('wallet', e => {
  // e.playerId
  // e.wallet.connecting
  // e.wallet.connected
  // e.wallet.address
})
```

## player.connect()

Client only.

Displays a modal for the player to select a wallet provider and then connect.

## player.disconnect()

Client only.

Disconnects the players current wallet.

## player.deposit(amount)

Server only.

Generates an unsigned transaction for the player to send `amount` to the world wallet, sends it to the client to be signed, and is then confirmed back on the server.

Returns a promise that resolves with the signature, or rejects with an error code.

## player.withdraw(amount)

Server only.

Generates an unsigned transaction for the player to receive `amoutn` from the world wallet, sends it to the client to be signed, and is then signed and confirmed back on the server.

Returns a promise that resolves with the signature, or rejects with an error code.




