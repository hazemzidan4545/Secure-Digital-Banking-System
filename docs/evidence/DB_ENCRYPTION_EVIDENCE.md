# Database Encryption-at-Rest Evidence

## Scope

This evidence demonstrates application-level encryption at rest for sensitive transaction notes in PostgreSQL using `pgcrypto`.

## Implemented Controls

- Schema includes encrypted column: `transactions.note_ciphertext` (`BYTEA`).
- Backend encrypts note values before insert with `pgp_sym_encrypt`.
- Backend decrypts for authorized reads with `pgp_sym_decrypt`.
- Encryption key is supplied via environment variable `DB_ENCRYPTION_KEY`.
- In production profile, `DB_ENCRYPTION_KEY` is mandatory.

## Evidence Commands

The following outputs are generated in this folder:

- `db_encryption_query_output.txt`: SQL query output showing ciphertext and null plaintext note.
- `db_encryption_hex_sample.txt`: Hex-encoded ciphertext sample proving non-plaintext storage.
- `api_transfer_encryption_flow.txt`: End-to-end API flow (register/login/MFA/transfer) that created an encrypted note record.

## Observed Evidence

- Latest transaction row shows `has_ciphertext = t` and non-zero `cipher_bytes`.
- Latest encrypted transaction stores no plaintext note (`note` is empty) and ciphertext bytes are present.
- Hex sample file contains encrypted byte sequence from `note_ciphertext`.

## Source References

- `backend/db/schema.sql`
- `backend/src/server.js`
- `backend/src/config.js`
- `docker-compose.yml`
- `docker-compose.prod.yml`
- `.env.prod.example`

## Conclusion

Transaction note values are stored encrypted in the database (`note_ciphertext`) and are not persisted as plaintext (`note` is null for encrypted inserts). This provides concrete encryption-at-rest evidence at application data layer.
