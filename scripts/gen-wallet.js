import { Keypair } from '@solana/web3.js'

const wallet = Keypair.generate()

// extract public and private keys
const publicKey = wallet.publicKey.toString()
const privateKey = Buffer.from(wallet.secretKey).toString('base64')

console.log('\n=== WORLD WALLET GENERATED SUCCESSFULLY ===\n')
console.log(`WORLD_PUBLIC_KEY=${publicKey}`)
console.log(`WORLD_PRIVATE_KEY=${privateKey}`)
