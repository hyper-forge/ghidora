import { BoltFFIHandle } from "@boltffi/runtime";
export interface FileEntry {
    readonly path: string;
    readonly data: Uint8Array;
}
export interface GraphPayload {
    readonly nodes: Array<TaskNode>;
    readonly packages: Array<PackageCard>;
    readonly initialSelectedId: string;
}
export interface PackageCard {
    readonly name: string;
    readonly deps: Array<string>;
    readonly description: string;
    readonly version: string;
    readonly _private: boolean;
    readonly kind: string;
    readonly homepage: string;
    readonly repository: string;
    readonly tasks: number;
}
export interface TaskNode {
    readonly id: string;
    readonly pkg: string;
    readonly task: string;
    readonly dependsOn: Array<string>;
}
export type ArchiveError = {
    readonly tag: "InvalidPath";
    readonly value0: string;
} | {
    readonly tag: "FileTooLarge";
} | {
    readonly tag: "ArchiveTooLarge";
} | {
    readonly tag: "TooManyEntries";
} | {
    readonly tag: "InvalidArchive";
    readonly value0: string;
};
export declare class ArchiveErrorException extends Error {
    readonly value: ArchiveError;
    constructor(value: ArchiveError);
}
export declare class BadgeKind extends BoltFFIHandle {
    protected static _typeName: string;
    private constructor();
    protected _release(handle: number): void;
    protected _unregister(): void;
    static _fromHandle(handle: number): BadgeKind;
}
export declare function badge(label: string, kind: number): string;
export declare function boxUi(title: string, body: string): string;
export declare function clear(): string;
export declare function clearLine(): string;
export declare function cursorTo(row: number, col: number): string;
export declare function drawStatic(): string;
export declare function generateGraphui(payload: GraphPayload): string;
export declare function getEsbuildConfig(): string;
export declare function getGhidoraConfig(): string;
export declare function getPackageTemplate(kind: string, name: string): string;
export declare function getTsconfig(kind: string): string;
export declare function ghidoraLogo(): string;
export declare function gradient(text: string): string;
export declare function hashBytes(input: Uint8Array): Uint8Array;
export declare function hashEquals(a: Uint8Array, b: Uint8Array): boolean;
export declare function header(text: string): string;
export declare function hideCursor(): string;
export declare function pickColor(name: string): number;
export declare function showCursor(): string;
export declare function spinnerAt(frame: number, row: number): string;
export declare function tarFilesEntries(files: Array<FileEntry>): Uint8Array;
export declare function targzFilesEntries(files: Array<FileEntry>): Uint8Array;
export declare function untarFilesEntries(data: Uint8Array): Array<FileEntry>;
export declare function untargzFilesEntries(data: Uint8Array): Array<FileEntry>;
export declare const initialized: Promise<void>;
export default function init(): Promise<void>;
export declare function __boltffiCancelById(callId: number): void;
