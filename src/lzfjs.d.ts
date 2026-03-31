declare module 'lzfjs' {
    export function decompress(input: Uint8Array | Buffer): Uint8Array;
    export function compress(input: Uint8Array | Buffer): Uint8Array;
}
