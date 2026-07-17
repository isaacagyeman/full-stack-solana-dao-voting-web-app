import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import { logger } from "./logger";

const MEMO_PROGRAM_ID = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");
const DEVNET_RPC = "https://api.devnet.solana.com";
const MIN_BALANCE_SOL = 0.1;

let _connection: Connection | null = null;
let _payer: Keypair | null = null;
let _initialized = false;

export function getConnection(): Connection {
  if (!_connection) {
    _connection = new Connection(DEVNET_RPC, "confirmed");
  }
  return _connection;
}

export async function initSolana(): Promise<void> {
  if (_initialized) return;
  _initialized = true;

  const connection = getConnection();

  const rawSecret = process.env["SOLANA_PAYER_SECRET"];
  if (rawSecret) {
    try {
      const secretKey = Uint8Array.from(JSON.parse(rawSecret) as number[]);
      _payer = Keypair.fromSecretKey(secretKey);
      logger.info({ pubkey: _payer.publicKey.toString() }, "Solana payer loaded from env");
    } catch {
      logger.warn("SOLANA_PAYER_SECRET is set but could not be parsed — generating ephemeral keypair");
    }
  }

  if (!_payer) {
    _payer = Keypair.generate();
    logger.warn(
      {
        pubkey: _payer.publicKey.toString(),
        secretKey: JSON.stringify(Array.from(_payer.secretKey)),
      },
      "No SOLANA_PAYER_SECRET set — generated ephemeral keypair. Save the secretKey above as SOLANA_PAYER_SECRET to persist it across restarts.",
    );
  }

  await ensureFunded(connection, _payer);
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function ensureFunded(connection: Connection, payer: Keypair): Promise<void> {
  try {
    const balance = await connection.getBalance(payer.publicKey);
    const solBalance = balance / LAMPORTS_PER_SOL;
    logger.info({ pubkey: payer.publicKey.toString(), solBalance }, "Solana payer balance");

    if (solBalance >= MIN_BALANCE_SOL) return;

    const amounts = [2 * LAMPORTS_PER_SOL, LAMPORTS_PER_SOL, Math.floor(0.5 * LAMPORTS_PER_SOL)];
    for (let attempt = 0; attempt < amounts.length; attempt++) {
      try {
        const sol = amounts[attempt]! / LAMPORTS_PER_SOL;
        logger.info({ attempt: attempt + 1, sol }, "Requesting devnet airdrop…");
        const sig = await connection.requestAirdrop(payer.publicKey, amounts[attempt]!);
        await connection.confirmTransaction(sig, "confirmed");
        const newBalance = await connection.getBalance(payer.publicKey);
        logger.info({ solBalance: newBalance / LAMPORTS_PER_SOL }, "Airdrop confirmed");
        return;
      } catch (err) {
        logger.warn({ attempt: attempt + 1, err }, "Airdrop attempt failed, retrying…");
        if (attempt < amounts.length - 1) await sleep(3000);
      }
    }
    logger.warn(
      { pubkey: payer.publicKey.toString() },
      `Airdrop failed after all attempts. Fund this address manually at https://faucet.solana.com/?address=${payer.publicKey.toString()}`,
    );
  } catch (err) {
    logger.warn({ err }, "Solana balance check failed — votes may not land on-chain");
  }
}

export async function submitVoteMemo(voteHash: string): Promise<{ txSignature: string | null; blockHeight: number | null }> {
  if (!_payer) {
    logger.warn("Solana payer not initialized — skipping on-chain submission");
    return { txSignature: null, blockHeight: null };
  }

  const connection = getConnection();

  try {
    const memo = new TransactionInstruction({
      keys: [{ pubkey: _payer.publicKey, isSigner: true, isWritable: false }],
      programId: MEMO_PROGRAM_ID,
      data: Buffer.from(`votechain:vote:${voteHash}`, "utf-8"),
    });

    const tx = new Transaction().add(memo);
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
    tx.recentBlockhash = blockhash;
    tx.feePayer = _payer.publicKey;

    tx.sign(_payer);

    const rawTx = tx.serialize();
    const txSignature = await connection.sendRawTransaction(rawTx, { skipPreflight: false });

    const slot = await connection.getSlot("confirmed");

    connection.confirmTransaction({ signature: txSignature, blockhash, lastValidBlockHeight }, "confirmed")
      .then(() => logger.info({ txSignature }, "Vote memo confirmed on Solana devnet"))
      .catch((err) => logger.warn({ err, txSignature }, "Vote memo confirmation timed out (tx may still land)"));

    return { txSignature, blockHeight: slot };
  } catch (err) {
    logger.error({ err }, "Solana on-chain submission failed — vote recorded in DB only");
    return { txSignature: null, blockHeight: null };
  }
}

export function getSolanaPayerPubkey(): string | null {
  return _payer?.publicKey.toString() ?? null;
}
