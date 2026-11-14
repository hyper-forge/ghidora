import { BoltFFIHandle, WASM_ABI_VERSION, instantiateBoltFFI, wireArraySize, wireStringSize } from "@boltffi/runtime";
import { wasmBindgen as _wasmBindgen } from "./ghidora_imports.js";
let _module;
let _exports;
const _callbackImports = {};
export default async function init(source) {
    let rollback;
    try {
        await instantiateBoltFFI(source, WASM_ABI_VERSION, {
            env: _callbackImports,
            wasmBindgen: _wasmBindgen,
            bind(module) {
                const previousModule = _module;
                const previousExports = _exports;
                _module = module;
                _exports = module.exports;
                rollback = () => {
                    if (_module !== module)
                        return;
                    _module = previousModule;
                    _exports = previousExports;
                };
            },
        });
    }
    catch (error) {
        rollback?.();
        throw error;
    }
}
// Lower-level counterpart to `options.signal` / `options.cancelId`.
// `callId` must be unique among in-flight calls -- see AsyncFutureManager.cancelById.
export function __boltffiCancelById(callId) {
    _module.asyncManager.cancelById(callId);
}
const FileEntryCodec = {
    size: (value) => (wireStringSize(value.path) + (4 + value.data.length)),
    encode: (writer, value) => {
        writer.writeString(value.path);
        writer.writeBytes(value.data);
    },
    decode: (reader) => {
        const path = reader.readString();
        const data = reader.readBytes();
        return {
            path: path,
            data: data,
        };
    },
};
const GraphPayloadCodec = {
    size: (value) => ((wireArraySize(value.nodes, (__boltffiValue0) => TaskNodeCodec.size(__boltffiValue0)) + wireArraySize(value.packages, (__boltffiValue0) => PackageCardCodec.size(__boltffiValue0))) + wireStringSize(value.initialSelectedId)),
    encode: (writer, value) => {
        writer.writeArray(value.nodes, (__boltffiValue0) => {
            TaskNodeCodec.encode(writer, __boltffiValue0);
        });
        writer.writeArray(value.packages, (__boltffiValue0) => {
            PackageCardCodec.encode(writer, __boltffiValue0);
        });
        writer.writeString(value.initialSelectedId);
    },
    decode: (reader) => {
        const nodes = reader.readArray(() => TaskNodeCodec.decode(reader));
        const packages = reader.readArray(() => PackageCardCodec.decode(reader));
        const initialSelectedId = reader.readString();
        return {
            nodes: nodes,
            packages: packages,
            initialSelectedId: initialSelectedId,
        };
    },
};
const PackageCardCodec = {
    size: (value) => ((((((((wireStringSize(value.name) + wireArraySize(value.deps, (__boltffiValue0) => wireStringSize(__boltffiValue0))) + wireStringSize(value.description)) + wireStringSize(value.version)) + 1) + wireStringSize(value.kind)) + wireStringSize(value.homepage)) + wireStringSize(value.repository)) + 4),
    encode: (writer, value) => {
        writer.writeString(value.name);
        writer.writeArray(value.deps, (__boltffiValue0) => {
            writer.writeString(__boltffiValue0);
        });
        writer.writeString(value.description);
        writer.writeString(value.version);
        writer.writeBool(value._private);
        writer.writeString(value.kind);
        writer.writeString(value.homepage);
        writer.writeString(value.repository);
        writer.writeUSize(value.tasks);
    },
    decode: (reader) => {
        const name = reader.readString();
        const deps = reader.readArray(() => reader.readString());
        const description = reader.readString();
        const version = reader.readString();
        const _private = reader.readBool();
        const kind = reader.readString();
        const homepage = reader.readString();
        const repository = reader.readString();
        const tasks = reader.readUSize();
        return {
            name: name,
            deps: deps,
            description: description,
            version: version,
            _private: _private,
            kind: kind,
            homepage: homepage,
            repository: repository,
            tasks: tasks,
        };
    },
};
const TaskNodeCodec = {
    size: (value) => (((wireStringSize(value.id) + wireStringSize(value.pkg)) + wireStringSize(value.task)) + wireArraySize(value.dependsOn, (__boltffiValue0) => wireStringSize(__boltffiValue0))),
    encode: (writer, value) => {
        writer.writeString(value.id);
        writer.writeString(value.pkg);
        writer.writeString(value.task);
        writer.writeArray(value.dependsOn, (__boltffiValue0) => {
            writer.writeString(__boltffiValue0);
        });
    },
    decode: (reader) => {
        const id = reader.readString();
        const pkg = reader.readString();
        const task = reader.readString();
        const dependsOn = reader.readArray(() => reader.readString());
        return {
            id: id,
            pkg: pkg,
            task: task,
            dependsOn: dependsOn,
        };
    },
};
export class ArchiveErrorException extends Error {
    constructor(value) {
        super("ArchiveError");
        this.value = value;
        this.name = "ArchiveErrorException";
    }
}
const ArchiveErrorCodec = {
    size: (value) => {
        switch (value.tag) {
            case "InvalidPath": return (4 + wireStringSize(value.value0));
            case "FileTooLarge": return 4;
            case "ArchiveTooLarge": return 4;
            case "TooManyEntries": return 4;
            case "InvalidArchive": return (4 + wireStringSize(value.value0));
        }
    },
    encode: (writer, value) => {
        switch (value.tag) {
            case "InvalidPath":
                writer.writeI32(0);
                writer.writeString(value.value0);
                break;
            case "FileTooLarge":
                writer.writeI32(1);
                break;
            case "ArchiveTooLarge":
                writer.writeI32(2);
                break;
            case "TooManyEntries":
                writer.writeI32(3);
                break;
            case "InvalidArchive":
                writer.writeI32(4);
                writer.writeString(value.value0);
                break;
        }
    },
    decode: (reader) => {
        const tag = reader.readI32();
        switch (tag) {
            case 0: return { tag: "InvalidPath", value0: reader.readString() };
            case 1: return { tag: "FileTooLarge" };
            case 2: return { tag: "ArchiveTooLarge" };
            case 3: return { tag: "TooManyEntries" };
            case 4: return { tag: "InvalidArchive", value0: reader.readString() };
            default: throw new Error(`Unknown ArchiveError wire tag: ${tag}`);
        }
    },
};
const _BadgeKindFinalizer = typeof FinalizationRegistry === "undefined"
    ? null
    : new FinalizationRegistry((handle) => {
        _exports.boltffi_release_class_7ghidora9BadgeKind(handle);
    });
export class BadgeKind extends BoltFFIHandle {
    constructor(handle) {
        super(handle);
        _BadgeKindFinalizer?.register(this, handle, this);
    }
    _release(handle) {
        _exports.boltffi_release_class_7ghidora9BadgeKind(handle);
    }
    _unregister() {
        _BadgeKindFinalizer?.unregister(this);
    }
    static _fromHandle(handle) {
        if (handle === 0) {
            throw new Error("BadgeKind received a null handle");
        }
        return new BadgeKind(handle);
    }
}
BadgeKind._typeName = "BadgeKind";
export function badge(label, kind) {
    const __boltffi_label_allocation = _module.allocOwnedString(label);
    return _module.takePackedUtf8String(_exports.boltffi_function_7ghidora5badge(__boltffi_label_allocation.ptr, __boltffi_label_allocation.len, kind));
}
export function boxUi(title, body) {
    const __boltffi_title_allocation = _module.allocOwnedString(title);
    const __boltffi_body_allocation = _module.allocOwnedString(body);
    return _module.takePackedUtf8String(_exports.boltffi_function_7ghidora6box_ui(__boltffi_title_allocation.ptr, __boltffi_title_allocation.len, __boltffi_body_allocation.ptr, __boltffi_body_allocation.len));
}
export function clear() {
    return _module.takePackedUtf8String(_exports.boltffi_function_7ghidora5clear());
}
export function clearLine() {
    return _module.takePackedUtf8String(_exports.boltffi_function_7ghidora10clear_line());
}
export function cursorTo(row, col) {
    return _module.takePackedUtf8String(_exports.boltffi_function_7ghidora9cursor_to(row, col));
}
export function drawStatic() {
    return _module.takePackedUtf8String(_exports.boltffi_function_7ghidora11draw_static());
}
export function generateGraphui(payload) {
    const __boltffi_payload_writer = _module.allocWriter(GraphPayloadCodec.size(payload));
    GraphPayloadCodec.encode(__boltffi_payload_writer, payload);
    try {
        return _module.takePackedUtf8String(_exports.boltffi_function_7ghidora16generate_graphui(__boltffi_payload_writer.ptr, __boltffi_payload_writer.len));
    }
    finally {
        _module.freeWriter(__boltffi_payload_writer);
    }
}
export function getEsbuildConfig() {
    return _module.takePackedUtf8String(_exports.boltffi_function_7ghidora18get_esbuild_config());
}
export function getGhidoraConfig() {
    return _module.takePackedUtf8String(_exports.boltffi_function_7ghidora18get_ghidora_config());
}
export function getPackageTemplate(kind, name) {
    const __boltffi_kind_allocation = _module.allocOwnedString(kind);
    const __boltffi_name_allocation = _module.allocOwnedString(name);
    return _module.takePackedUtf8String(_exports.boltffi_function_7ghidora20get_package_template(__boltffi_kind_allocation.ptr, __boltffi_kind_allocation.len, __boltffi_name_allocation.ptr, __boltffi_name_allocation.len));
}
export function getTsconfig(kind) {
    const __boltffi_kind_allocation = _module.allocOwnedString(kind);
    return _module.takePackedUtf8String(_exports.boltffi_function_7ghidora12get_tsconfig(__boltffi_kind_allocation.ptr, __boltffi_kind_allocation.len));
}
export function ghidoraLogo() {
    return _module.takePackedUtf8String(_exports.boltffi_function_7ghidora12ghidora_logo());
}
export function gradient(text) {
    const __boltffi_text_allocation = _module.allocOwnedString(text);
    return _module.takePackedUtf8String(_exports.boltffi_function_7ghidora8gradient(__boltffi_text_allocation.ptr, __boltffi_text_allocation.len));
}
export function hashBytes(input) {
    const __boltffi_input_allocation = _module.allocWireBytes(input);
    try {
        return _module.takePackedBytes(_exports.boltffi_function_7ghidora10hash_bytes(__boltffi_input_allocation.ptr, __boltffi_input_allocation.len));
    }
    finally {
        _module.freeAlloc(__boltffi_input_allocation);
    }
}
export function hashEquals(a, b) {
    const __boltffi_a_allocation = _module.allocWireBytes(a);
    const __boltffi_b_allocation = _module.allocWireBytes(b);
    try {
        return _exports.boltffi_function_7ghidora11hash_equals(__boltffi_a_allocation.ptr, __boltffi_a_allocation.len, __boltffi_b_allocation.ptr, __boltffi_b_allocation.len) !== 0;
    }
    finally {
        _module.freeAlloc(__boltffi_a_allocation);
        _module.freeAlloc(__boltffi_b_allocation);
    }
}
export function header(text) {
    const __boltffi_text_allocation = _module.allocOwnedString(text);
    return _module.takePackedUtf8String(_exports.boltffi_function_7ghidora6header(__boltffi_text_allocation.ptr, __boltffi_text_allocation.len));
}
export function hideCursor() {
    return _module.takePackedUtf8String(_exports.boltffi_function_7ghidora11hide_cursor());
}
export function pickColor(name) {
    const __boltffi_name_allocation = _module.allocOwnedString(name);
    return _exports.boltffi_function_7ghidora10pick_color(__boltffi_name_allocation.ptr, __boltffi_name_allocation.len);
}
export function showCursor() {
    return _module.takePackedUtf8String(_exports.boltffi_function_7ghidora11show_cursor());
}
export function spinnerAt(frame, row) {
    return _module.takePackedUtf8String(_exports.boltffi_function_7ghidora10spinner_at(frame, row));
}
export function tarFilesEntries(files) {
    const __boltffi_files_writer = _module.allocWriter(wireArraySize(files, (__boltffiValue0) => FileEntryCodec.size(__boltffiValue0)));
    __boltffi_files_writer.writeArray(files, (__boltffiValue0) => {
        FileEntryCodec.encode(__boltffi_files_writer, __boltffiValue0);
    });
    try {
        const __boltffiReturnWriter = _module.allocWriter(8);
        try {
            const __boltffiError = _exports.boltffi_function_7ghidora17tar_files_entries(__boltffi_files_writer.ptr, __boltffi_files_writer.len, __boltffiReturnWriter.ptr);
            if (__boltffiError !== 0n) {
                const __boltffiErrorReader = _module.takePackedBuffer(__boltffiError);
                throw new ArchiveErrorException(ArchiveErrorCodec.decode(__boltffiErrorReader));
            }
            return _module.takePackedBytes(_module.readerFromWriter(__boltffiReturnWriter).readU64());
        }
        finally {
            _module.freeWriter(__boltffiReturnWriter);
        }
    }
    finally {
        _module.freeWriter(__boltffi_files_writer);
    }
}
export function targzFilesEntries(files) {
    const __boltffi_files_writer = _module.allocWriter(wireArraySize(files, (__boltffiValue0) => FileEntryCodec.size(__boltffiValue0)));
    __boltffi_files_writer.writeArray(files, (__boltffiValue0) => {
        FileEntryCodec.encode(__boltffi_files_writer, __boltffiValue0);
    });
    try {
        const __boltffiReturnWriter = _module.allocWriter(8);
        try {
            const __boltffiError = _exports.boltffi_function_7ghidora19targz_files_entries(__boltffi_files_writer.ptr, __boltffi_files_writer.len, __boltffiReturnWriter.ptr);
            if (__boltffiError !== 0n) {
                const __boltffiErrorReader = _module.takePackedBuffer(__boltffiError);
                throw new ArchiveErrorException(ArchiveErrorCodec.decode(__boltffiErrorReader));
            }
            return _module.takePackedBytes(_module.readerFromWriter(__boltffiReturnWriter).readU64());
        }
        finally {
            _module.freeWriter(__boltffiReturnWriter);
        }
    }
    finally {
        _module.freeWriter(__boltffi_files_writer);
    }
}
export function untarFilesEntries(data) {
    const __boltffi_data_allocation = _module.allocWireBytes(data);
    try {
        const __boltffiReturnWriter = _module.allocWriter(8);
        try {
            const __boltffiError = _exports.boltffi_function_7ghidora19untar_files_entries(__boltffi_data_allocation.ptr, __boltffi_data_allocation.len, __boltffiReturnWriter.ptr);
            if (__boltffiError !== 0n) {
                const __boltffiErrorReader = _module.takePackedBuffer(__boltffiError);
                throw new ArchiveErrorException(ArchiveErrorCodec.decode(__boltffiErrorReader));
            }
            const __boltffiReader = _module.takePackedBuffer(_module.readerFromWriter(__boltffiReturnWriter).readU64());
            return __boltffiReader.readArray(() => FileEntryCodec.decode(__boltffiReader));
        }
        finally {
            _module.freeWriter(__boltffiReturnWriter);
        }
    }
    finally {
        _module.freeAlloc(__boltffi_data_allocation);
    }
}
export function untargzFilesEntries(data) {
    const __boltffi_data_allocation = _module.allocWireBytes(data);
    try {
        const __boltffiReturnWriter = _module.allocWriter(8);
        try {
            const __boltffiError = _exports.boltffi_function_7ghidora21untargz_files_entries(__boltffi_data_allocation.ptr, __boltffi_data_allocation.len, __boltffiReturnWriter.ptr);
            if (__boltffiError !== 0n) {
                const __boltffiErrorReader = _module.takePackedBuffer(__boltffiError);
                throw new ArchiveErrorException(ArchiveErrorCodec.decode(__boltffiErrorReader));
            }
            const __boltffiReader = _module.takePackedBuffer(_module.readerFromWriter(__boltffiReturnWriter).readU64());
            return __boltffiReader.readArray(() => FileEntryCodec.decode(__boltffiReader));
        }
        finally {
            _module.freeWriter(__boltffiReturnWriter);
        }
    }
    finally {
        _module.freeAlloc(__boltffi_data_allocation);
    }
}
//# sourceMappingURL=ghidora.js.map