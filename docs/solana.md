# Solana

## World Token

Your world accepts deposits and withdrawals of a specific token. This is specified with the `WORLD_TOKEN_MINT_ADDRESS` in your `.env`

## World Wallet

Your world has its own wallet that deposits go into, and withdrawals come out of.

You can generate a new wallet by running `node ./scripts/gen-wallet.js` and pasting these values into your `.env`

## player.wallet

Either a `String` wallet address or `null`. This is automatically synchronized and accessable by apps on both the client and server.

## world.on('wallet', callback)

Apps can also subscribe to global player wallet changes on both the client and server.

```jsx
world.on('wallet', e => {
  // e.playerId
  // e.wallet
})
```

## player.connect()

On the client this invokes a connect and sign flow, which is then verified on the server before updating the `player.wallet` value and emitting the `wallet` change event above.

On the server this sends a network event to the client to invoke the above.

## player.disconnect()

Disconnects the players current wallet. Can be used on the client or server, and clears the `player.wallet` value. Also emits a `wallet` change event.

## player.deposit(amount)

Server only.

Generates an unsigned transaction for the player to send `amount` to the world wallet, sends it to the client to be signed, and is then confirmed back on the server.

Returns a promise that resolves with the signature, or rejects with an error code.

## player.withdraw(amount)

Server only.

Generates an unsigned transaction for the player to receive `amoutn` from the world wallet, sends it to the client to be signed, and is then signed and confirmed back on the server.

Returns a promise that resolves with the signature, or rejects with an error code.