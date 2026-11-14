/* tslint:disable */
/* eslint-disable */

export enum BadgeKind {
    Success = 0,
    Info = 1,
    Warn = 2,
    Error = 3,
}

/**
 * -------------------------------
 * Log color logic
 * -------------------------------
 */
export enum LogColor {
    Gray = 0,
    Red = 1,
    Green = 2,
    Yellow = 3,
    Blue = 4,
    Magenta = 5,
    Cyan = 6,
}

export function badge(label: string, kind: BadgeKind): string;

export function box_ui(title: string, body: string): string;

export function clear(): string;

export function clear_line(): string;

export function cursor_to(row: number, col: number): string;

export function draw_static(): string;

export function generate_graphui(payload: any): string;

export function get_esbuild_config(): string;

export function get_ghidora_config(): string;

/**
 *  Package.json GENERATORS
 * -------------------------------
 */
export function get_package_template(kind: string, name: string): string;

/**
 * -------------------------------
 * Public config API
 * -------------------------------
 */
export function get_tsconfig(kind: string): string;

export function ghidora_logo(): string;

export function gradient(text: string): string;

/**
 * Hash raw bytes → 32-byte BLAKE3 hash
 */
export function hash_bytes(input: Uint8Array): Uint8Array;

export function hash_equals(a: Uint8Array, b: Uint8Array): boolean;

export function header(text: string): string;

export function hide_cursor(): string;

export function pick_color(name: string): number;

export function show_cursor(): string;

export function spinner_at(frame: number, row: number): string;

export function tar_files(files: any): Uint8Array;

export function targz_files(files: any): Uint8Array;

export function untar_files(data: Uint8Array): any;

export function untargz_files(data: Uint8Array): any;
