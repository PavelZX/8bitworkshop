
import { RAM, RasterVideo, KeyFlags, dumpRAM, AnimationTimer, setKeyboardFromMap, padBytes, ControllerPoller } from "./emu";
import { hex, printFlags, invertMap, getBasePlatform } from "./util";
import { CodeAnalyzer } from "./analysis";
import { Segment } from "./workertypes";
import { disassemble6502 } from "./cpu/disasm6502";
import { disassembleZ80 } from "./cpu/disasmz80";
import { Z80 } from "./cpu/ZilogZ80";

declare var jt, CPU6809;

export interface OpcodeMetadata {
  minCycles: number;
  maxCycles: number;
  insnlength: number;
  opcode: number;
}

export interface CpuState {
  PC:number;
  EPC?:number; // effective PC (for bankswitching)
  o?:number;/*opcode*/
  SP?:number
  /*
  A:number, X:number, Y:number, SP:number, R:boolean,
  N,V,D,Z,C:boolean*/
};
export interface EmuState {
  c?:CpuState,	// CPU state
  b?:Uint8Array|number[], 	// RAM (TODO: not for vcs, support Uint8Array)
  ram?:Uint8Array,
  o?:{},				// verilog
};
export interface EmuControlsState {
}
export type DisasmLine = {
  line:string,
  nbytes:number,
  isaddr:boolean
};

export type SymbolMap = {[ident:string]:number};
export type AddrSymbolMap = {[address:number]:string};

export class DebugSymbols {
  symbolmap : SymbolMap;	// symbol -> address
  addr2symbol : AddrSymbolMap;	// address -> symbol

  constructor(symbolmap : SymbolMap) {
    this.symbolmap = symbolmap;
    this.addr2symbol = invertMap(symbolmap);
    //// TODO: shouldn't be necc.
    if (!this.addr2symbol[0x0]) this.addr2symbol[0x0] = '$00'; // needed for ...
    this.addr2symbol[0x10000] = '__END__'; // ... dump memory to work
  }
}

type MemoryMapType = "main" | "vram";
type MemoryMap = { [type:string] : Segment[] };

export function isDebuggable(arg:any): arg is Debuggable {
    return typeof arg.getDebugCategories === 'function';
}

export interface Debuggable {
  getDebugCategories?() : string[];
  getDebugInfo?(category:string, state:EmuState) : string;
}

export interface Platform {
  start() : void | Promise<void>;
  reset() : void;
  isRunning() : boolean;
  getToolForFilename(s:string) : string;
  getDefaultExtension() : string;
  getPresets() : Preset[];
  pause() : void;
  resume() : void;
  loadROM(title:string, rom:any); // TODO: Uint8Array
  loadBIOS?(title:string, rom:Uint8Array);

  loadState?(state : EmuState) : void;
  saveState?() : EmuState;
  loadControlsState?(state : EmuControlsState) : void;
  saveControlsState?() : EmuControlsState;

  inspect?(ident:string) : string;
  disassemble?(addr:number, readfn:(addr:number)=>number) : DisasmLine;
  readAddress?(addr:number) : number;
  readVRAMAddress?(addr:number) : number;
  
  setFrameRate?(fps:number) : void;
  getFrameRate?() : number;

  setupDebug?(callback : BreakpointCallback) : void;
  clearDebug?() : void;
  step?() : void;
  runToVsync?() : void;
  runToPC?(pc:number) : void;
  runUntilReturn?() : void;
  stepBack?() : void;
  runEval?(evalfunc : DebugEvalCondition) : void;
  runToFrameClock?(clock : number) : void;

  getOpcodeMetadata?(opcode:number, offset:number) : OpcodeMetadata; //TODO
  getSP?() : number;
  getPC?() : number;
  getOriginPC?() : number;
  newCodeAnalyzer?() : CodeAnalyzer;
  
  getPlatformName?() : string;
  getMemoryMap?() : MemoryMap;

  setRecorder?(recorder : EmuRecorder) : void;
  advance?(novideo? : boolean) : void;
  showHelp?(tool:string, ident?:string) : void;
  resize?() : void;

  getRasterScanline?() : number;
  setBreakpoint?(id : string, cond : DebugCondition);
  clearBreakpoint?(id : string);
  getCPUState?() : CpuState;

  debugSymbols? : DebugSymbols;
  
  startProbing?() : ProbeRecorder;
  stopProbing?() : void;
}

export interface Preset {
  id : string;
  name : string;
  chapter? : number;
  title? : string;
}

export interface MemoryBus {
  read : (address:number) => number;
  write : (address:number, value:number) => void;
  contend?: (address:number, cycles:number) => number;
  isContended?: (address:number) => boolean;
}

export type DebugCondition = () => boolean;
export type DebugEvalCondition = (c:CpuState) => boolean;
export type BreakpointCallback = (s:EmuState, msg?:string) => void;
// for composite breakpoints w/ single debug function
export class BreakpointList {
  id2bp : {[id:string] : Breakpoint} = {};
  getDebugCondition() : DebugCondition {
    if (Object.keys(this.id2bp).length == 0) {
      return null; // no breakpoints
    } else {
      // evaluate all breakpoints
      return () => {
        var result = false;
        for (var id in this.id2bp)
          if (this.id2bp[id].cond())
            result = true;
        return result;
      };
    }
  }
}
export type Breakpoint = {cond:DebugCondition};

export interface EmuRecorder {
  frameRequested() : boolean;
  recordFrame(state : EmuState);
}

/////

export abstract class BasePlatform {
  recorder : EmuRecorder = null;
  debugSymbols : DebugSymbols;

  abstract loadState(state : EmuState) : void;
  abstract saveState() : EmuState;
  abstract pause() : void;
  abstract resume() : void;
  abstract advance(novideo? : boolean) : void;

  setRecorder(recorder : EmuRecorder) : void {
    this.recorder = recorder;
  }
  updateRecorder() {
    // are we recording and do we need to save a frame?
    if (this.recorder && (<Platform><any>this).isRunning() && this.recorder.frameRequested()) {
      this.recorder.recordFrame(this.saveState());
    }
  }
}

export abstract class BaseDebugPlatform extends BasePlatform {
  onBreakpointHit : BreakpointCallback;
  debugCallback : DebugCondition;
  debugSavedState : EmuState = null;
  debugBreakState : EmuState = null;
  debugTargetClock : number = 0;
  debugClock : number = 0;
  breakpoints : BreakpointList = new BreakpointList();
  frameCount : number = 0;

  abstract getCPUState() : CpuState;
  abstract readAddress(addr:number) : number;

  setBreakpoint(id : string, cond : DebugCondition) {
    if (cond) {
      this.breakpoints.id2bp[id] = {cond:cond};
      this.restartDebugging();
    } else {
      this.clearBreakpoint(id);
    }
  }
  clearBreakpoint(id : string) {
    delete this.breakpoints.id2bp[id];
  }
  getDebugCallback() : DebugCondition {
    return this.breakpoints.getDebugCondition();
  }
  setupDebug(callback : BreakpointCallback) : void {
    this.onBreakpointHit = callback;
  }
  clearDebug() {
    this.debugSavedState = null;
    this.debugBreakState = null;
    this.debugTargetClock = -1;
    this.debugClock = 0;
    this.onBreakpointHit = null;
    this.clearBreakpoint('debug');
    this.frameCount = 0;
  }
  setDebugCondition(debugCond : DebugCondition) {
    this.setBreakpoint('debug', debugCond);
  }
  restartDebugging() {
    if (this.debugSavedState) {
      this.loadState(this.debugSavedState);
    } else {
      this.debugSavedState = this.saveState();
    }
    this.debugClock = 0;
    this.debugCallback = this.getDebugCallback();
    this.debugBreakState = null;
    this.resume();
  }
  preFrame() {
    // save state before frame, to record any inputs that happened pre-frame
    if (this.debugCallback && !this.debugBreakState) {
      // save state every frame and rewind debug clocks
      this.debugSavedState = this.saveState();
      this.debugTargetClock -= this.debugClock;
      this.debugClock = 0;
    }
  }
  postFrame() {
    // reload debug state at end of frame after breakpoint
    if (this.debugCallback && this.debugBreakState) {
      this.loadState(this.debugBreakState);
    }
    this.frameCount++;
  }
  pollControls() {
  }
  nextFrame(novideo : boolean) {
    this.pollControls();
    this.updateRecorder();
    this.preFrame();
    this.advance(novideo);
    this.postFrame();
  }
  // default debugging
  abstract getSP() : number;
  abstract getPC() : number;
  abstract isStable() : boolean;

  evalDebugCondition() {
    if (this.debugCallback && !this.debugBreakState) {
      this.debugCallback();
    }
  }
  wasBreakpointHit() : boolean {
    return this.debugBreakState != null;
  }
  breakpointHit(targetClock : number, reason? : string) {
    console.log(this.debugTargetClock, targetClock, this.debugClock, this.isStable());
    this.debugTargetClock = targetClock;
    this.debugBreakState = this.saveState();
    console.log("Breakpoint at clk", this.debugClock, "PC", this.debugBreakState.c.PC.toString(16));
    this.pause();
    if (this.onBreakpointHit) {
      this.onBreakpointHit(this.debugBreakState, reason);
    }
  }
  haltAndCatchFire(reason : string) {
    this.breakpointHit(this.debugClock, reason);
  }
  runEval(evalfunc : DebugEvalCondition) {
    this.setDebugCondition( () => {
      if (++this.debugClock >= this.debugTargetClock && this.isStable()) {
        var cpuState = this.getCPUState();
        if (evalfunc(cpuState)) {
          this.breakpointHit(this.debugClock);
          return true;
        } else {
          return false;
        }
      }
    });
  }
  runUntilReturn() {
    var SP0 = this.getSP();
    this.runEval( (c:CpuState) : boolean => {
      return c.SP > SP0;
    });
  }
  runToFrameClock(clock : number) : void {
    this.restartDebugging();
    this.debugTargetClock = clock;
    this.runEval(() : boolean => { return true; });
  }
  step() {
    this.runToFrameClock(this.debugClock+1);
  }
  stepBack() {
    var prevState;
    var prevClock;
    var clock0 = this.debugTargetClock;
    this.restartDebugging();
    this.debugTargetClock = clock0 - 25; // TODO: depends on CPU
    this.runEval( (c:CpuState) : boolean => {
      if (this.debugClock < clock0) {
        prevState = this.saveState();
        prevClock = this.debugClock;
        return false;
      } else {
        if (prevState) {
          this.loadState(prevState);
          this.debugClock = prevClock;
        }
        return true;
      }
    });
  }
  runToVsync() {
    this.restartDebugging();
    var frame0 = this.frameCount;
    this.runEval( () : boolean => {
      return this.frameCount > frame0;
    });
  }
}

////// 6502

export function getToolForFilename_6502(fn:string) : string {
  if (fn.endsWith(".pla")) return "plasm";
  if (fn.endsWith(".c")) return "cc65";
  if (fn.endsWith(".h")) return "cc65";
  if (fn.endsWith(".s")) return "ca65";
  if (fn.endsWith(".ca65")) return "ca65";
  if (fn.endsWith(".dasm")) return "dasm";
  if (fn.endsWith(".acme")) return "acme";
  return "dasm"; // .a
}

// TODO: can merge w/ Z80?
export abstract class Base6502Platform extends BaseDebugPlatform {

  // some platforms store their PC one byte before or after the first opcode
  // so we correct when saving and loading from state
  debugPCDelta = -1;
  fixPC(c)   { c.PC = (c.PC + this.debugPCDelta) & 0xffff; return c; }
  unfixPC(c) { c.PC = (c.PC - this.debugPCDelta) & 0xffff; return c;}
  getSP()    { return this.getCPUState().SP };
  getPC()    { return this.getCPUState().PC };
  isStable() { return !this.getCPUState()['T']; }

  newCPU(membus : MemoryBus) {
    var cpu = new jt.M6502();
    cpu.connectBus(membus);
    return cpu;
  }

  getOpcodeMetadata(opcode, offset) {
    return getOpcodeMetadata_6502(opcode, offset);
  }

  getOriginPC() : number {
    return (this.readAddress(0xfffc) | (this.readAddress(0xfffd) << 8)) & 0xffff;
  }

  disassemble(pc:number, read:(addr:number)=>number) : DisasmLine {
    return disassemble6502(pc, read(pc), read(pc+1), read(pc+2));
  }
  getToolForFilename = getToolForFilename_6502;
  getDefaultExtension() { return ".a"; };

  getDebugCategories() {
    return ['CPU','ZPRAM','Stack'];
  }
  getDebugInfo(category:string, state:EmuState) : string {
    switch (category) {
      case 'CPU':   return cpuStateToLongString_6502(state.c);
      case 'ZPRAM': return dumpRAM(state.b||state.ram, 0x0, 0x100);
      case 'Stack': return dumpStackToString(<Platform><any>this, state.b||state.ram, 0x100, 0x1ff, 0x100+state.c.SP, 0x20);
    }
  }
}

export function cpuStateToLongString_6502(c) : string {
  function decodeFlags(c) {
    var s = "";
    s += c.N ? " N" : " -";
    s += c.V ? " V" : " -";
    s += c.D ? " D" : " -";
    s += c.Z ? " Z" : " -";
    s += c.C ? " C" : " -";
    s += c.I ? " I" : " -";
    return s;
  }
  return "PC " + hex(c.PC,4) + "  " + decodeFlags(c) + "\n"
       + " A " + hex(c.A)    + "     " + (c.R ? "" : "BUSY") + "\n"
       + " X " + hex(c.X)    + "\n"
       + " Y " + hex(c.Y)    + "     " + "SP " + hex(c.SP) + "\n";
}

var OPMETA_6502 = {
  cycletime: [
  7, 6, 0, 8, 3, 3, 5, 5, 3, 2, 2, 2, 4, 4, 6, 6,    2, 5, 0, 8, 4, 4, 6, 6, 2, 4, 0, 7, 4, 4, 7, 7,    6, 6, 0, 8, 3, 3, 5, 5, 4, 2, 2, 2, 4, 4, 6, 6,    2, 5, 0, 8, 4, 4, 6, 6, 2, 4, 0, 7, 4, 4, 7, 7,    6, 6, 0, 8, 3, 3, 5, 5, 3, 2, 2, 2, 3, 4, 6, 6,    2, 5, 0, 8, 4, 4, 6, 6, 2, 4, 0, 7, 4, 4, 7, 7,    6, 6, 0, 8, 3, 3, 5, 5, 4, 2, 2, 2, 5, 4, 6, 6,    2, 5, 0, 8, 4, 4, 6, 6, 2, 4, 0, 7, 4, 4, 7, 7,    0, 6, 0, 6, 3, 3, 3, 3, 2, 0, 2, 0, 4, 4, 4, 4,    2, 6, 0, 0, 4, 4, 4, 4, 2, 5, 2, 0, 0, 5, 0, 0,    2, 6, 2, 6, 3, 3, 3, 3, 2, 2, 2, 0, 4, 4, 4, 4,    2, 5, 0, 5, 4, 4, 4, 4, 2, 4, 2, 0, 4, 4, 4, 4,    2, 6, 0, 8, 3, 3, 5, 5, 2, 2, 2, 2, 4, 4, 3, 6,    2, 5, 0, 8, 4, 4, 6, 6, 2, 4, 0, 7, 4, 4, 7, 7,    2, 6, 0, 8, 3, 3, 5, 5, 2, 2, 2, 0, 4, 4, 6, 6,    2, 5, 0, 8, 4, 4, 6, 6, 2, 4, 0, 7, 4, 4, 7, 7
  ],
  extracycles: [
  0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,    2, 1, 0, 1, 0, 0, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1,    0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,    2, 1, 0, 1, 0, 0, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1,    0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,    2, 1, 0, 1, 0, 0, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1,    0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,    2, 1, 0, 1, 0, 0, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1,    0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,    2, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0,    0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,    2, 1, 0, 1, 0, 0, 0, 1, 0, 1, 0, 0, 1, 1, 1, 1,    0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,    2, 1, 0, 1, 0, 0, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1,    0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,    2, 1, 0, 1, 0, 0, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1
  ],
  insnlengths: [
  1, 2, 0, 2, 2, 2, 2, 2, 1, 2, 1, 2, 3, 3, 3, 3,    2, 2, 0, 2, 2, 2, 2, 2, 1, 3, 0, 3, 3, 3, 3, 3,    3, 2, 0, 2, 2, 2, 2, 2, 1, 2, 1, 2, 3, 3, 3, 3,    2, 2, 0, 2, 2, 2, 2, 2, 1, 3, 0, 3, 3, 3, 3, 3,    1, 2, 0, 2, 2, 2, 2, 2, 1, 2, 1, 2, 3, 3, 3, 3,    2, 2, 0, 2, 2, 2, 2, 2, 1, 3, 0, 3, 3, 3, 3, 3,    1, 2, 0, 2, 2, 2, 2, 2, 1, 2, 1, 2, 3, 3, 3, 3,    2, 2, 0, 2, 2, 2, 2, 2, 1, 3, 0, 3, 3, 3, 3, 3,    0, 2, 0, 2, 2, 2, 2, 2, 1, 0, 1, 0, 3, 3, 3, 3,    2, 2, 0, 0, 2, 2, 2, 3, 1, 3, 1, 0, 0, 3, 0, 0,    2, 2, 2, 2, 2, 2, 2, 2, 1, 2, 1, 0, 3, 3, 3, 3,    2, 2, 0, 2, 2, 2, 2, 2, 1, 3, 1, 0, 3, 3, 3, 3,    2, 2, 0, 2, 2, 2, 2, 2, 1, 2, 1, 2, 3, 3, 3, 3,    2, 2, 0, 2, 2, 2, 2, 2, 1, 3, 0, 3, 3, 3, 3, 3,    2, 2, 0, 2, 2, 2, 2, 2, 1, 2, 1, 0, 3, 3, 3, 3,    2, 2, 0, 2, 2, 2, 2, 2, 1, 3, 0, 3, 3, 3, 3, 3
  ],
  validinsns: [
  1, 2, 0, 0, 0, 2, 2, 0, 1, 2, 1, 0, 0, 3, 3, 0,    2, 2, 0, 0, 0, 2, 2, 0, 1, 3, 0, 0, 0, 3, 3, 0,    3, 2, 0, 0, 2, 2, 2, 0, 1, 2, 1, 0, 3, 3, 3, 0,    2, 2, 0, 0, 0, 2, 2, 0, 1, 3, 0, 0, 0, 3, 3, 0,    1, 2, 0, 0, 0, 2, 2, 0, 1, 2, 1, 0, 3, 3, 3, 0,    2, 2, 0, 0, 0, 2, 2, 0, 1, 3, 0, 0, 0, 3, 3, 0,    1, 2, 0, 0, 0, 2, 2, 0, 1, 2, 1, 0, 3, 3, 3, 0,    2, 2, 0, 0, 0, 2, 2, 0, 1, 3, 0, 0, 0, 3, 3, 0,    0, 2, 0, 0, 2, 2, 2, 0, 1, 0, 1, 0, 3, 3, 3, 0,    2, 2, 0, 0, 2, 2, 2, 0, 1, 3, 1, 0, 0, 3, 0, 0,    2, 2, 2, 0, 2, 2, 2, 0, 1, 2, 1, 0, 3, 3, 3, 0,    2, 2, 0, 0, 2, 2, 2, 0, 1, 3, 1, 0, 3, 3, 3, 0,    2, 2, 0, 0, 2, 2, 2, 0, 1, 2, 1, 0, 3, 3, 3, 0,    2, 2, 0, 0, 0, 2, 2, 0, 1, 3, 0, 0, 0, 3, 3, 0,    2, 2, 0, 0, 2, 2, 2, 0, 1, 2, 1, 0, 3, 3, 3, 0,    2, 2, 0, 0, 0, 2, 2, 0, 1, 3, 0, 0, 0, 3, 3, 0
  ],
}

export function getOpcodeMetadata_6502(opcode, address) {
  // TODO: more intelligent maximum cycles
  // TODO: must always be new object, b/c we might modify it
  return {
    opcode:opcode,
    minCycles:OPMETA_6502.cycletime[opcode],
    maxCycles:OPMETA_6502.cycletime[opcode] + OPMETA_6502.extracycles[opcode],
    insnlength:OPMETA_6502.insnlengths[opcode]
  };
}

////// Z80

export function cpuStateToLongString_Z80(c) {
  function decodeFlags(flags) {
    return printFlags(flags, ["S","Z",,"H",,"V","N","C"], true);
  }
  return "PC " + hex(c.PC,4) + "  " + decodeFlags(c.AF) + " " + (c.iff1?"I":"-") + (c.iff2?"I":"-") + "\n"
       + "SP " + hex(c.SP,4) + "  IR " + hex(c.IR,4) + "\n"
       + "IX " + hex(c.IX,4) + "  IY " + hex(c.IY,4) + "\n"
       + "AF " + hex(c.AF,4) + "  BC " + hex(c.BC,4) + "\n"
       + "DE " + hex(c.DE,4) + "  HL " + hex(c.HL,4) + "\n"
       ;
}

export abstract class BaseZ80Platform extends BaseDebugPlatform {

  _cpu;
  waitCycles : number = 0;

  newCPU(membus : MemoryBus, iobus : MemoryBus) {
    this._cpu = new Z80();
    this._cpu.connectMemoryBus(membus);
    this._cpu.connectIOBus(iobus);
    return this._cpu;
  }

  getPC() { return this._cpu.getPC(); }
  getSP() { return this._cpu.getSP(); }
  isStable() { return true; }

  // TODO: refactor other parts into here
  runCPU(cpu, cycles:number) {
    this._cpu = cpu; // TODO?
    this.waitCycles = 0; // TODO: needs to spill over betwenn calls
    if (this.wasBreakpointHit())
      return 0;
    var debugCond = this.getDebugCallback();
    var n = 0;
    this.waitCycles += cycles;
    while (this.waitCycles > 0) {
      if (debugCond && debugCond()) {
        debugCond = null;
        break;
      }
      var cyc = cpu.advanceInsn();
      n += cyc;
      this.waitCycles -= cyc;
    }
    return n;
  }

  getToolForFilename = getToolForFilename_z80;
  getDefaultExtension() { return ".c"; };
  // TODO: Z80 opcode metadata
  //this.getOpcodeMetadata = function() { }

  getDebugCategories() {
    return ['CPU','Stack'];
  }
  getDebugInfo(category:string, state:EmuState) : string {
    switch (category) {
      case 'CPU':   return cpuStateToLongString_Z80(state.c);
      case 'Stack': {
        var sp = (state.c.SP-1) & 0xffff;
        var start = sp & 0xff00;
        var end = start + 0xff;
        if (sp == 0) sp = 0x10000;
        console.log(sp,start,end);
        return dumpStackToString(<Platform><any>this, [], start, end, sp, 0xcd);
      }
    }
  }
  disassemble(pc:number, read:(addr:number)=>number) : DisasmLine {
    return disassembleZ80(pc, read(pc), read(pc+1), read(pc+2), read(pc+3));
  }
}

export function getToolForFilename_z80(fn) : string {
  if (fn.endsWith(".c")) return "sdcc";
  if (fn.endsWith(".h")) return "sdcc";
  if (fn.endsWith(".s")) return "sdasz80";
  if (fn.endsWith(".ns")) return "naken";
  if (fn.endsWith(".scc")) return "sccz80";
  if (fn.endsWith(".z")) return "zmac";
  return "zmac";
}

////// 6809

export function cpuStateToLongString_6809(c) {
  function decodeFlags(flags) {
    return printFlags(flags, ["E","F","H","I", "N","Z","V","C"], true);
  }
  return "PC " + hex(c.PC,4) + "  " + decodeFlags(c.CC) + "\n"
       + "SP " + hex(c.SP,4) + "\n"
       + " A " + hex(c.A,2) + "\n"
       + " B " + hex(c.B,2) + "\n"
       + " X " + hex(c.X,4) + "\n"
       + " Y " + hex(c.Y,4) + "\n"
       + " U " + hex(c.U,4) + "\n"
       ;
}

export function getToolForFilename_6809(fn:string) : string {
  if (fn.endsWith(".c")) return "cmoc";
  if (fn.endsWith(".h")) return "cmoc";
  if (fn.endsWith(".xasm")) return "xasm6809";
  return "lwasm";
}

export abstract class Base6809Platform extends BaseZ80Platform {

  newCPU(membus : MemoryBus) {
    var cpu = new CPU6809();
    cpu.init(membus.write, membus.read, 0);
    return cpu;
  }

  getPC() { return this._cpu.PC; }
  getSP() { return this._cpu.SP; }

  cpuStateToLongString(c:CpuState) {
    return cpuStateToLongString_6809(c);
  }
  disassemble(pc:number, read:(addr:number)=>number) : DisasmLine {
    // TODO: don't create new CPU
    return new CPU6809().disasm(read(pc), read(pc+1), read(pc+2), read(pc+3), read(pc+4), pc);
  }
  getDefaultExtension() : string { return ".asm"; };
  //this.getOpcodeMetadata = function() { }
  getToolForFilename = getToolForFilename_6809;
  getDebugCategories() {
    return ['CPU','Stack'];
  }
  getDebugInfo(category:string, state:EmuState) : string {
    switch (category) {
      case 'CPU':   return cpuStateToLongString_6809(state.c);
      default:      return super.getDebugInfo(category, state);
    }
  }
}

/// MAME SUPPORT

declare var FS, ENV, Module; // mame emscripten

export abstract class BaseMAMEPlatform {

  loaded : boolean = false;
  preinitted : boolean = false;
  started : boolean = false;
  romfn : string;
  romdata : Uint8Array;
  video;
  running = false;
  console_vars : {[varname:string]:string[]} = {};
  console_varname : string;
  initluavars : boolean = false;
  luadebugscript : string;
  js_lua_string;
  onBreakpointHit;
  mainElement : HTMLElement;

  constructor(mainElement) {
    this.mainElement = mainElement;
  }

  luareset() {
    this.console_vars = {};
  }

  // http://docs.mamedev.org/techspecs/luaengine.html
  luacall(s) {
    this.console_varname = null;
    //Module.ccall('_Z13js_lua_stringPKc', 'void', ['string'], [s+""]);
    if (!this.js_lua_string) this.js_lua_string = Module.cwrap('_Z13js_lua_stringPKc', 'void', ['string']);
    this.js_lua_string(s || "");
  }

  pause() {
    if (this.loaded && this.running) {
      this.luacall('emu.pause()');
      this.running = false;
    }
  }

  resume() {
    if (this.loaded && !this.running) { // TODO
      this.luacall('emu.unpause()');
      this.running = true;
    }
  }

  reset() {
    if (this.loaded) {
      this.luacall('manager:machine():soft_reset()');
      this.running = true;
      this.initluavars = false;
    }
  }

  isRunning() {
    return this.running;
  }

  bufferConsoleOutput(s) {
    if (typeof s !== 'string') return;
    if (s.startsWith(">>>")) {
      this.console_varname = s.length > 3 ? s.slice(3) : null;
      if (this.console_varname) this.console_vars[this.console_varname] = [];
    } else if (this.console_varname) {
      this.console_vars[this.console_varname].push(s);
      if (this.console_varname == 'debug_stopped') {
        var debugSaveState = this.preserveState();
        this.pause();
        if (this.onBreakpointHit) {
          this.onBreakpointHit(debugSaveState);
        }
      }
    } else {
      console.log(s);
    }
  }

  startModule(mainElement, opts) {
    this.started = true;
    var romfn = this.romfn = this.romfn || opts.romfn;
    var romdata = this.romdata = this.romdata || opts.romdata || new RAM(opts.romsize).mem;
    // create canvas
    var video = this.video = new RasterVideo(this.mainElement, opts.width, opts.height);
    video.create();
    $(video.canvas).attr('id','canvas');
    // load asm.js module
    console.log("loading", opts.jsfile);
    var modargs = [opts.driver,
      '-debug',
      '-debugger', 'none',
      '-verbose', '-window', '-nokeepaspect',
      '-resolution', video.canvas.width+'x'+video.canvas.height
    ];
    if (romfn) modargs.push('-cart', romfn);
    window['JSMESS'] = {};
    window['Module'] = {
      arguments: modargs,
      screenIsReadOnly: true,
      print: this.bufferConsoleOutput,
      canvas:video.canvas,
      doNotCaptureKeyboard:true,
      keyboardListeningElement:video.canvas,
      preInit: () => {
        console.log("loading FS");
        ENV.SDL_EMSCRIPTEN_KEYBOARD_ELEMENT = 'canvas';
        if (opts.cfgfile) {
          FS.mkdir('/cfg');
          FS.writeFile('/cfg/' + opts.cfgfile, opts.cfgdata, {encoding:'utf8'});
        }
        if (opts.biosfile) {
          FS.mkdir('/roms');
          FS.mkdir('/roms/' + opts.driver);
          FS.writeFile('/roms/' + opts.biosfile, opts.biosdata, {encoding:'binary'});
        }
        FS.mkdir('/emulator');
        if (romfn) {
          FS.writeFile(romfn, romdata, {encoding:'binary'});
        }
        //FS.writeFile('/debug.ini', 'debugger none\n', {encoding:'utf8'});
        if (opts.preInit) {
          opts.preInit(self);
        }
        this.preinitted = true;
      },
      preRun: [
        () => {
          $(video.canvas).click((e) =>{
            video.canvas.focus();
          });
          this.loaded = true;
          console.log("about to run...");
        }
      ]
    };
    // preload files
    // TODO: ensure loaded
    var fetch_cfg, fetch_lua;
    var fetch_bios = $.Deferred();
    var fetch_wasm = $.Deferred();
    // fetch config file
    if (opts.cfgfile) {
      fetch_cfg = $.get('mame/cfg/' + opts.cfgfile, (data) => {
        opts.cfgdata = data;
        console.log("loaded " + opts.cfgfile);
      }, 'text');
    }
    // fetch BIOS file
    if (opts.biosfile) {
      var oReq1 = new XMLHttpRequest();
      oReq1.open("GET", 'mame/roms/' + opts.biosfile, true);
      oReq1.responseType = "arraybuffer";
      oReq1.onload = (oEvent) => {
        opts.biosdata = new Uint8Array(oReq1.response);
        console.log("loaded " + opts.biosfile); // + " (" + oEvent.total + " bytes)");
        fetch_bios.resolve();
      };
      oReq1.ontimeout = function (oEvent) {
        throw Error("Timeout loading " + opts.biosfile);
      }
      oReq1.send();
    } else {
      fetch_bios.resolve();
    }
    // load debugger Lua script
    fetch_lua = $.get('mame/debugger.lua', (data) => {
      this.luadebugscript = data;
      console.log("loaded debugger.lua");
    }, 'text');
    // load WASM
    {
      var oReq2 = new XMLHttpRequest();
      oReq2.open("GET", 'mame/' + opts.jsfile.replace('.js','.wasm'), true);
      oReq2.responseType = "arraybuffer";
      oReq2.onload = (oEvent) => {
        console.log("loaded WASM file");
        window['Module'].wasmBinary = new Uint8Array(oReq2.response);
        fetch_wasm.resolve();
      };
      oReq2.ontimeout = function (oEvent) {
        throw Error("Timeout loading " + opts.jsfile);
      }
      oReq2.send();
    }
    // start loading script
    $.when(fetch_lua, fetch_cfg, fetch_bios, fetch_wasm).done( () => {
      var script = document.createElement('script');
      script.src = 'mame/' + opts.jsfile;
      document.getElementsByTagName('head')[0].appendChild(script);
      console.log("created script element");
    });
  }

  loadROMFile(data) {
    this.romdata = data;
    if (this.preinitted && this.romfn) {
      FS.writeFile(this.romfn, data, {encoding:'binary'});
    }
  }

  loadRegion(region, data) {
    if (this.loaded && data.length > 0) {
      //this.luacall('cart=manager:machine().images["cart"]\nprint(cart:filename())\ncart:load("' + romfn + '")\n');
      var s = 'rgn = manager:machine():memory().regions["' + region + '"]\n';
      //s += 'print(rgn.size)\n';
      for (var i=0; i<data.length; i+=4) {
        var v = data[i] + (data[i+1]<<8) + (data[i+2]<<16) + (data[i+3]<<24);
        s += 'rgn:write_u32(' + i + ',' + v + ')\n'; // TODO: endian?
      }
      this.luacall(s);
      this.reset();
    }
  }

  preserveState() {
    var state = {c:{}};
    for (var k in this.console_vars) {
      if (k.startsWith("cpu_")) {
        var v = parseInt(this.console_vars[k][0]);
        state.c[k.slice(4)] = v;
      }
    }
    // TODO: memory?
    return state;
  }

  initlua() {
    if (!this.initluavars) {
      this.luacall(this.luadebugscript);
      this.luacall('mamedbg.init()')
      this.initluavars = true;
    }
  }

  // DEBUGGING SUPPORT
/*
  saveState() {
    this.luareset();
    this.luacall('mamedbg.printstate()');
    return this.preserveState();
  }
  readAddress(a) {
    this.initlua();
    this.luacall('print(">>>v"); print(mem:read_u8(' + a + '))');
    return parseInt(this.console_vars.v[0]);
  }
  clearDebug() {
    this.onBreakpointHit = null;
  }
  getDebugCallback() {
    return this.onBreakpointHit;// TODO?
  }
  setupDebug(callback) {
    if (this.loaded) { // TODO?
      this.initlua();
      this.luareset();
    }
    this.onBreakpointHit = callback;
  }
  runToPC(pc) {
    this.luacall('mamedbg.runTo(' + pc + ')');
    this.resume();
  }
  runToVsync() {
    this.luacall('mamedbg.runToVsync()');
    this.resume();
  }
  runUntilReturn() {
    this.luacall('mamedbg.runUntilReturn()');
    this.resume();
  }
  step() {
    this.luacall('mamedbg.step()');
    this.resume();
  }
  // TODO: other than z80
  cpuStateToLongString(c) {
    if (c.HL)
      return cpuStateToLongString_Z80(c);
    else
      return null; // TODO
  }
*/	
}

export function dumpStackToString(platform:Platform, mem:Uint8Array|number[], start:number, end:number, sp:number, jsrop:number) : string {
  var s = "";
  var nraw = 0;
  //s = dumpRAM(mem.slice(start,start+end+1), start, end-start+1);
  function read(addr) {
    if (addr < mem.length) return mem[addr];
    else return platform.readAddress(addr);
  }
  while (sp < end) {
    sp++;
    // see if there's a JSR on the stack here
    // TODO: make work with roms and memory maps
    var addr = read(sp) + read(sp+1)*256;
    var jsrofs = jsrop==0x20 ? -2 : -3; // 6502 vs Z80
    var opcode = read(addr + jsrofs); // might be out of bounds
    if (opcode == jsrop) { // JSR
      s += "\n$" + hex(sp) + ": ";
      s += hex(addr,4) + " " + lookupSymbol(platform, addr, true);
      sp++;
      nraw = 0;
    } else {
      if (nraw == 0)
        s += "\n$" + hex(sp) + ": ";
      s += hex(read(sp)) + " ";
      if (++nraw == 8) nraw = 0;
    }
  }
  return s+"\n";
}

// TODO: slow, funky, uses global
export function lookupSymbol(platform:Platform, addr:number, extra:boolean) {
  var start = addr;
  var addr2symbol = platform.debugSymbols && platform.debugSymbols.addr2symbol;
  while (addr2symbol && addr >= 0) {
    var sym = addr2symbol[addr];
    if (sym) { // return first symbol we find
      var sym = addr2symbol[addr];
      return extra ? (sym + " + $" + hex(start-addr)) : sym;
    }
    if (!extra) break;
    addr--;
  }
  return "";
}

/// new Machine platform adapters

import { Bus, Resettable, FrameBased, VideoSource, SampledAudioSource, AcceptsROM, AcceptsKeyInput, SavesState, SavesInputState, HasCPU, TrapCondition, CPU } from "./devices";
import { Probeable, RasterFrameBased, AcceptsPaddleInput, SampledAudioSink } from "./devices";
import { SampledAudio } from "./audio";
import { ProbeRecorder } from "./recorder";

interface Machine extends Bus, Resettable, FrameBased, AcceptsROM, HasCPU, SavesState<EmuState>, SavesInputState<any> {
}

function hasVideo(arg:any): arg is VideoSource {
    return typeof arg.connectVideo === 'function';
}
function hasAudio(arg:any): arg is SampledAudioSource {
    return typeof arg.connectAudio === 'function';
}
function hasKeyInput(arg:any): arg is AcceptsKeyInput {
    return typeof arg.setKeyInput === 'function';
}
function hasPaddleInput(arg:any): arg is AcceptsPaddleInput {
    return typeof arg.setPaddleInput === 'function';
}
function isRaster(arg:any): arg is RasterFrameBased {
    return typeof arg.getRasterY === 'function';
}
function hasProbe(arg:any): arg is Probeable {
    return typeof arg.connectProbe == 'function';
}

export abstract class BaseMachinePlatform<T extends Machine> extends BaseDebugPlatform implements Platform {
  machine : T;
  mainElement : HTMLElement;
  timer : AnimationTimer;
  video : RasterVideo;
  audio : SampledAudio;
  poller : ControllerPoller;
  probeRecorder : ProbeRecorder;
  startProbing;
  stopProbing;
  
  abstract newMachine() : T;
  abstract getToolForFilename(s:string) : string;
  abstract getDefaultExtension() : string;
  abstract getPresets() : Preset[];
  
  constructor(mainElement : HTMLElement) {
    super();
    this.mainElement = mainElement;
    this.machine = this.newMachine();
  }

  reset()        { this.machine.reset(); }
  loadState(s)   { this.machine.loadState(s); }
  saveState()    { return this.machine.saveState(); }
  getSP()        { return this.machine.cpu.getSP(); }
  getPC()        { return this.machine.cpu.getPC(); }
  isStable() 	 { return this.machine.cpu.isStable(); }
  getCPUState()  { return this.machine.cpu.saveState(); }
  loadControlsState(s)   { this.machine.loadControlsState(s); }
  saveControlsState()    { return this.machine.saveControlsState(); }
  
  start() {
    const m = this.machine;
    var videoFrequency;
    if (hasVideo(m)) {
      var vp = m.getVideoParams();
      this.video = new RasterVideo(this.mainElement, vp.width, vp.height, {overscan:!!vp.overscan,rotate:vp.rotate|0});
      this.video.create();
      m.connectVideo(this.video.getFrameData());
      // TODO: support keyboard w/o video?
      if (hasKeyInput(m)) {
        this.video.setKeyboardEvents(m.setKeyInput.bind(m));
        this.poller = new ControllerPoller(m.setKeyInput.bind(m));
      }
      videoFrequency = vp.videoFrequency;
    }
    this.timer = new AnimationTimer(videoFrequency || 60, this.nextFrame.bind(this));
    if (hasAudio(m)) {
      var ap = m.getAudioParams();
      this.audio = new SampledAudio(ap.sampleRate);
      this.audio.start();
      m.connectAudio(this.audio);
    }
    if (hasPaddleInput(m)) {
      this.video.setupMouseEvents();
    }
    if (hasProbe(m)) {
      this.probeRecorder = new ProbeRecorder(m);
      this.startProbing = () => {
        m.connectProbe(this.probeRecorder);
        return this.probeRecorder;
      };
      this.stopProbing = () => {
        m.connectProbe(null);
      };
    }
  }
  
  loadROM(title, data) {
    this.machine.loadROM(data);
    this.reset();
  }

  pollControls() {
    this.poller && this.poller.poll();
    if (hasPaddleInput(this.machine)) {
      this.machine.setPaddleInput(0, this.video.paddle_x);
      this.machine.setPaddleInput(1, this.video.paddle_y);
    }
  }

  advance(novideo:boolean) {
    this.machine.advanceFrame(this.getDebugCallback());
    if (!novideo && this.video) this.video.updateFrame();
  }

  isRunning() {
    return this.timer && this.timer.isRunning();
  }

  resume() {
    this.timer.start();
    this.audio && this.audio.start();
  }

  pause() {
    this.timer.stop();
    this.audio && this.audio.stop();
  }

// TODO: reset target clock counter
  getRasterScanline() {
    return isRaster(this.machine) && this.machine.getRasterY();
  }
}

// TODO: move debug info into CPU?

export abstract class Base6502MachinePlatform<T extends Machine> extends BaseMachinePlatform<T> {

  getOpcodeMetadata     = getOpcodeMetadata_6502;
  getToolForFilename    = getToolForFilename_6502;

  disassemble(pc:number, read:(addr:number)=>number) : DisasmLine {
    return disassemble6502(pc, read(pc), read(pc+1), read(pc+2));
  }
  getDebugCategories() {
    if (isDebuggable(this.machine))
      return this.machine.getDebugCategories();
    else
      return ['CPU','ZPRAM','Stack'];
  }
  getDebugInfo(category:string, state:EmuState) : string {
    switch (category) {
      case 'CPU':   return cpuStateToLongString_6502(state.c);
      case 'ZPRAM': return dumpRAM(state.b||state.ram, 0x0, 0x100);
      case 'Stack': return dumpStackToString(<Platform><any>this, state.b||state.ram, 0x100, 0x1ff, 0x100+state.c.SP, 0x20);
      default: return isDebuggable(this.machine) && this.machine.getDebugInfo(category, state);
    }
  }
}

export abstract class BaseZ80MachinePlatform<T extends Machine> extends BaseMachinePlatform<T> {

  //getOpcodeMetadata     = getOpcodeMetadata_z80;
  getToolForFilename    = getToolForFilename_z80;

  getDebugCategories() {
    if (isDebuggable(this.machine))
      return this.machine.getDebugCategories();
    else
      return ['CPU','Stack'];
  }
  getDebugInfo(category:string, state:EmuState) : string {
    switch (category) {
      case 'CPU':   return cpuStateToLongString_Z80(state.c);
      case 'Stack': {
        var sp = (state.c.SP-1) & 0xffff;
        var start = sp & 0xff00;
        var end = start + 0xff;
        if (sp == 0) sp = 0x10000;
        console.log(sp,start,end);
        return dumpStackToString(<Platform><any>this, [], start, end, sp, 0xcd);
      }
      default: return isDebuggable(this.machine) && this.machine.getDebugInfo(category, state);
    }
  }
  disassemble(pc:number, read:(addr:number)=>number) : DisasmLine {
    return disassembleZ80(pc, read(pc), read(pc+1), read(pc+2), read(pc+3));
  }

}

// WASM Support
// TODO: detangle from c64

export class WASMMachine implements Machine {

  prefix : string;
  instance : WebAssembly.Instance;
  exports : any;
  sys : number;
  pixel_dest : Uint32Array;
  pixel_src : Uint32Array;
  romptr : number;
  romlen : number;
  romarr : Uint8Array;
  stateptr : number;
  statearr : Uint8Array;
  cpustateptr : number;
  cpustatearr : Uint8Array;
  cpu : CPU;
  audio : SampledAudioSink;
  audioarr : Float32Array;
  prgstart : number;
  initstring : string;
  initindex : number;
  joymask0 = 0;

  constructor(prefix: string) {
    this.prefix = prefix;
    var self = this;
    this.cpu = {
      getPC: self.getPC.bind(self),
      getSP: self.getSP.bind(self),
      isStable: self.isStable.bind(self),
      reset: self.reset.bind(self),
      saveState: () => {
        return self.getCPUState();
      },
      loadState: () => {
        console.log("loadState not implemented")
      },
      connectMemoryBus() {
        console.log("connectMemoryBus not implemented")
      },
    }
  }
  async loadWASM() {
    // fetch WASM
    var wasmResponse = await fetch('wasm/'+this.prefix+'.wasm');
    var wasmBinary = await wasmResponse.arrayBuffer();
    var wasmCompiled = await WebAssembly.compile(wasmBinary);
    var wasmResult = await WebAssembly.instantiate(wasmCompiled);
    this.instance = wasmResult;
    this.exports = wasmResult.exports;
    this.exports.memory.grow(32);
    // fetch BIOS
    var biosResponse = await fetch('wasm/'+this.prefix+'.bios');
    var biosBinary = await biosResponse.arrayBuffer();
    const cBIOSPointer = this.exports.malloc(0x5000);
    const srcArray = new Uint8Array(biosBinary);
    const destArray = new Uint8Array(this.exports.memory.buffer, cBIOSPointer, 0x5000);
    destArray.set(srcArray);
    // init machine instance
    this.sys = this.exports.machine_init(cBIOSPointer);
    console.log('machine_init', this.sys);
    // create state buffers
    var statesize = this.exports.machine_get_state_size();
    this.stateptr = this.exports.malloc(statesize);
    this.statearr = new Uint8Array(this.exports.memory.buffer, this.stateptr, statesize);
    var cpustatesize = this.exports.machine_get_cpu_state_size();
    this.cpustateptr = this.exports.malloc(cpustatesize);
    this.cpustatearr = new Uint8Array(this.exports.memory.buffer, this.cpustateptr, cpustatesize);
    // create audio buffer
    var sampbufsize = 4096*4;
    this.audioarr = new Float32Array(this.exports.memory.buffer, this.exports.machine_get_sample_buffer(), sampbufsize);
    // enable c64 joystick map to arrow keys (TODO)
    //this.exports.c64_set_joystick_type(this.sys, 1);
  }
  reset() {
    this.exports.machine_reset(this.sys);
    // load rom
    if (this.romptr && this.romlen) {
      this.exports.machine_load_rom(this.sys, this.romptr, this.romlen);
      this.prgstart = this.romarr[0] + (this.romarr[1]<<8); // TODO: get starting address
      if (this.prgstart == 0x801) this.prgstart = 0x80d;
    }
    // set init string
    // TODO: sometimes gets hung up
    if (this.prgstart) {
      this.initstring = "\r\r\r\r\r\r\r\r\r\r\rSYS " + this.prgstart + "\r";
      this.initindex = 0;
    }
  }
  getPC() : number {
    return this.exports.machine_cpu_get_pc(this.sys);
  }
  getSP() : number {
    return this.exports.machine_cpu_get_sp(this.sys);
  }
  isStable() : boolean {
    return this.exports.machine_cpu_is_stable(this.sys);
  }
  loadROM(rom: Uint8Array) {
    if (!this.romptr) {
      this.romptr = this.exports.malloc(0x10000);
      this.romarr = new Uint8Array(this.exports.memory.buffer, this.romptr, 0x10000);
    }
    this.romarr.set(rom);
    this.romlen = rom.length;
    this.reset();
  }
  advanceFrame(trap: TrapCondition) : number {
    var i : number;
    var cpf = 19656; // TODO: pal, const
    if (trap) {
      for (i=0; i<cpf; i++) {
        if (trap && trap()) {
          break;
        }
        this.exports.machine_tick(this.sys);
      }
    } else {
      this.exports.machine_exec(this.sys, cpf);
      i = cpf;
      this.typeInitString(); // TODO: type init string into console (doesnt work on reset)
    }
    this.syncVideo();
    this.syncAudio();
    return i;
  }
  typeInitString() {
    if (this.initstring) {
      var ch = this.initstring.charCodeAt(this.initindex >> 1);
      this.setKeyInput(ch, 0, (this.initindex&1) ? KeyFlags.KeyUp : KeyFlags.KeyDown);
      if (++this.initindex >= this.initstring.length*2) this.initstring = null;
    }
  }
  read(address: number) : number {
    return this.exports.machine_mem_read(this.sys, address & 0xffff);
  }
  readConst(address: number) : number {
    return this.exports.machine_mem_read(this.sys, address & 0xffff);
  }
  write(address: number, value: number) : void {
    this.exports.machine_mem_write(this.sys, address & 0xffff, value & 0xff);
  }
  getCPUState() {
    this.exports.machine_save_cpu_state(this.sys, this.cpustateptr);
    var s = this.cpustatearr;
    return {
      PC:s[2] + (s[3]<<8),
      SP:s[9],
      A:s[6],
      X:s[7],
      Y:s[8],
      C:s[10] & 1,
      Z:s[10] & 2,
      I:s[10] & 4,
      D:s[10] & 8,
      V:s[10] & 64,
      N:s[10] & 128,
    }
  }
  saveState() {
    this.exports.machine_save_state(this.sys, this.stateptr);
    return {
      c:this.getCPUState(),
      state:this.statearr.slice(0)
    };
  }
  loadState(state) : void {
    this.statearr.set(state.state);
    this.exports.machine_load_state(this.sys, this.stateptr);
  }
  // assume controls buffer is smaller than cpu buffer
  saveControlsState() : any {
    this.exports.machine_save_controls_state(this.sys, this.cpustateptr);
    return { controls:this.cpustatearr.slice(0, this.exports.machine_get_controls_state_size()) }
  }
  loadControlsState(state) : void {
    this.cpustatearr.set(state.controls);
    this.exports.machine_load_controls_state(this.sys, this.cpustateptr);
  }
  getVideoParams() {
   return {width:392, height:272, overscan:true, videoFrequency:50}; // TODO: const
  }
  getAudioParams() {
    return {sampleRate:44100, stereo:false};
  }
  connectVideo(pixels:Uint32Array) : void {
    this.pixel_dest = pixels;
    // save video pointer
    var pixbuf = this.exports.machine_get_pixel_buffer(this.sys);
    this.pixel_src = new Uint32Array(this.exports.memory.buffer, pixbuf, pixels.length);
    console.log(pixbuf, pixels.length);
  }
  syncVideo() {
    if (this.pixel_dest != null) {
      this.pixel_dest.set(this.pixel_src);
    }
  }
  setKeyInput(key: number, code: number, flags: number): void {
    // TODO: handle shifted keys
    if (key == 16 || key == 17 || key == 18 || key == 224) return; // meta keys
    //console.log(key, code, flags);
    //if (flags & KeyFlags.Shift) { key += 64; }
    // convert to c64
    var mask = 0;
    if (key == 37) { key = 0x8; mask = 0x4; } // LEFT
    if (key == 38) { key = 0xb; mask = 0x1; } // UP
    if (key == 39) { key = 0x9; mask = 0x8; } // RIGHT
    if (key == 40) { key = 0xa; mask = 0x2; } // DOWN
    if (flags & KeyFlags.KeyDown) {
      this.exports.machine_key_down(this.sys, key);
      this.joymask0 |= mask;
    } else if (flags & KeyFlags.KeyUp) {
      this.exports.machine_key_up(this.sys, key);
      this.joymask0 &= ~mask;
    }
    this.exports.c64_joystick(this.sys, this.joymask0, 0); // TODO: c64
  }
  connectAudio(audio : SampledAudioSink) : void {
    this.audio = audio;
  }
  syncAudio() {
    if (this.audio != null) {
      var n = this.exports.machine_get_sample_count();
      for (var i=0; i<n; i++) {
        this.audio.feedSample(this.audioarr[i], 1);
      }
    }
  }
}