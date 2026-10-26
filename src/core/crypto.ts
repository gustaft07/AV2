import * as crypto from "crypto";

const AES_ALGO = "aes-256-gcm";
const IV_LEN = 12; 
const SALT_LEN = 16;
const SCRYPT_KEYLEN = 32; 
const PASSWORD_HASH_ROUNDS = 100_000;

export interface PacoteCriptografado {
  iv: string; 
  tag: string;
  dados: string; 
}

export function derivarChave(segredo: string, salt: Buffer): Buffer {
  return crypto.scryptSync(segredo, salt, SCRYPT_KEYLEN, {
    N: 16384,
    r: 8,
    p: 1,
  });
}

export function gerarSalt(): Buffer {
  return crypto.randomBytes(SALT_LEN);
}

export function gerarChaveAleatoria(): Buffer {
  return crypto.randomBytes(32); 
}

export function criptografar(
  textoPlano: string,
  chave: Buffer
): PacoteCriptografado {
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(AES_ALGO, chave, iv);
  const ciphertext = Buffer.concat([
    cipher.update(textoPlano, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return {
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    dados: ciphertext.toString("base64"),
  };
}

export function descriptografar(
  pacote: PacoteCriptografado,
  chave: Buffer
): string {
  const decipher = crypto.createDecipheriv(
    AES_ALGO,
    chave,
    Buffer.from(pacote.iv, "base64")
  );
  decipher.setAuthTag(Buffer.from(pacote.tag, "base64"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(pacote.dados, "base64")),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
}

export function hashSenha(senha: string, saltExistente?: Buffer): {
  hash: string;
  salt: string;
} {
  const salt = saltExistente ?? gerarSalt();
  let atual = Buffer.concat([salt, Buffer.from(senha, "utf8")]);
  for (let i = 0; i < PASSWORD_HASH_ROUNDS; i++) {
    atual = crypto.createHash("sha256").update(atual).digest();
  }
  return { hash: atual.toString("hex"), salt: salt.toString("base64") };
}

export function verificarSenha(
  senha: string,
  hashArmazenado: string,
  saltBase64: string
): boolean {
  const salt = Buffer.from(saltBase64, "base64");
  const { hash } = hashSenha(senha, salt);
  const a = Buffer.from(hash, "hex");
  const b = Buffer.from(hashArmazenado, "hex");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
