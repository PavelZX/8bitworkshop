"use strict";

import $ = require("jquery");
import { CodeProject } from "./project";
import { SourceFile, WorkerError } from "./workertypes";
import { Platform } from "./baseplatform";

export interface ProjectView {
  createDiv(parent:HTMLElement, text:string) : HTMLElement;
  refresh() : void;
  tick?() : void;
  getValue?() : string;
  getCursorPC?() : number;
  getSourceFile?() : SourceFile;
  setGutterBytes?(line:number, s:string) : void;
  openBitmapEditorAtCursor?() : void;
  markErrors?(errors:WorkerError[]) : void;
  clearErrors?() : void;
};

// TODO: move to different namespace
declare var CodeMirror;
declare var platform : Platform;
declare var platform_id : string;
declare var compparams;
declare var addr2symbol : {[addr:number]:string};
declare var current_project : CodeProject;
declare var VirtualList;
declare var lastDebugState;

// TODO: functions
declare function inspectVariable(ed, name?:string);

// helper function for editor
function jumpToLine(ed, i:number) {
  var t = ed.charCoords({line: i, ch: 0}, "local").top;
  var middleHeight = ed.getScrollerElement().offsetHeight / 2;
  ed.scrollTo(null, t - middleHeight - 5);
}

function getVisibleEditorLineHeight() : number{
  return $(".CodeMirror-line:visible").first().height();
}

/////

export class SourceEditor implements ProjectView {
  constructor(path:string, mode:string) {
    this.path = path;
    this.mode = mode;
  }
  path : string;
  mode : string;
  editor;
  dirtylisting = true;
  sourcefile : SourceFile;
  currentDebugLine : number;
  errormsgs = [];
  errorwidgets = [];
  
  createDiv(parent:HTMLElement, text:string) {
    var div = document.createElement('div');
    div.setAttribute("class", "editor");
    parent.appendChild(div);
    this.newEditor(div);
    if (text)
      this.setText(text); // TODO: this calls setCode() and builds... it shouldn't
    return div;
  }

  newEditor(parent:HTMLElement) {
    var isAsm = this.mode=='6502' || this.mode =='z80' || this.mode=='verilog' || this.mode=='gas'; // TODO
    this.editor = CodeMirror(parent, {
      theme: 'mbo',
      lineNumbers: true,
      matchBrackets: true,
      tabSize: 8,
      indentAuto: true,
      gutters: isAsm ? ["CodeMirror-linenumbers", "gutter-offset", "gutter-bytes", "gutter-clock", "gutter-info"]
                     : ["CodeMirror-linenumbers", "gutter-offset", "gutter-info"],
    });
    var timer;
    this.editor.on('changes', (ed, changeobj) => {
      clearTimeout(timer);
      timer = setTimeout( () => {
        current_project.updateFile(this.path, this.editor.getValue());
      }, 300);
    });
    this.editor.on('cursorActivity', (ed) => {
      var start = this.editor.getCursor(true);
      var end = this.editor.getCursor(false);
      if (start.line == end.line && start.ch < end.ch) {
        var name = this.editor.getSelection();
        inspectVariable(this.editor, name);
      } else {
        inspectVariable(this.editor);
      }
    });
    //scrollProfileView(editor);
    this.editor.setOption("mode", this.mode);
  }

  setText(text:string) {
    this.editor.setValue(text); // calls setCode()
    this.editor.clearHistory();
  }
  
  getValue() : string {
    return this.editor.getValue();
  }
  
  getPath() : string { return this.path; }

  addErrorMarker(line:number, msg:string) {
    var div = document.createElement("div");
    div.setAttribute("class", "tooltipbox tooltiperror");
    div.appendChild(document.createTextNode("\u24cd"));
    this.editor.setGutterMarker(line, "gutter-info", div);
    this.errormsgs.push({line:line, msg:msg});
    // expand line widgets when mousing over errors
    $(div).mouseover((e) => {
      this.expandErrors();
    });
  }
  
  addErrorLine(line:number, msg:string) {
    var errspan = document.createElement("span");
    errspan.setAttribute("class", "tooltiperrorline");
    errspan.appendChild(document.createTextNode(msg));
    this.errorwidgets.push(this.editor.addLineWidget(line, errspan));
  }
  
  expandErrors() {
    var e;
    while (e = this.errormsgs.shift()) {
      this.addErrorLine(e.line, e.msg);
    }
  }
  
  markErrors(errors:WorkerError[]) {
    // TODO: move cursor to error line if offscreen?
    this.clearErrors();
    var numLines = this.editor.lineCount();
    for (var info of errors) {
      // only mark errors with this filename, or without any filename
      if (!info.path || this.path.endsWith(info.path)) {
        var line = info.line-1;
        if (line < 0 || line >= numLines) line = 0;
        this.addErrorMarker(line, info.msg);
      }
    }
  }
  
  clearErrors() {
    this.editor.clearGutter("gutter-info");
    this.refreshDebugState();
    this.dirtylisting = true;
    // clear line widgets
    this.errormsgs = [];
    while (this.errorwidgets.length)
      this.errorwidgets.shift().clear();
  }
  
  getSourceFile() : SourceFile { return this.sourcefile; }

  // TODO: update gutter only when refreshing this window
  updateListing(_sourcefile : SourceFile) {
    this.sourcefile = _sourcefile;
    // update editor annotations
    this.editor.clearGutter("gutter-info");
    this.editor.clearGutter("gutter-bytes");
    this.editor.clearGutter("gutter-offset");
    this.editor.clearGutter("gutter-clock");
    var lstlines = this.sourcefile.lines || [];
    for (var info of lstlines) {
      if (info.offset >= 0) {
        var textel = document.createTextNode(hex(info.offset,4));
        this.editor.setGutterMarker(info.line-1, "gutter-offset", textel);
      }
      if (info.insns) {
        var insnstr = info.insns.length > 9 ? ("...") : info.insns;
        var textel = document.createTextNode(insnstr);
        this.editor.setGutterMarker(info.line-1, "gutter-bytes", textel);
        if (info.iscode) {
          var opcode = parseInt(info.insns.split(" ")[0], 16);
          if (platform.getOpcodeMetadata) {
            var meta = platform.getOpcodeMetadata(opcode, info.offset);
            var clockstr = meta.minCycles+"";
            var textel = document.createTextNode(clockstr);
            this.editor.setGutterMarker(info.line-1, "gutter-clock", textel);
          }
        }
      }
    }
  }
  
  setGutterBytes(line:number, s:string) {
    var textel = document.createTextNode(s);
    this.editor.setGutterMarker(line-1, "gutter-bytes", textel);
  }
  
  setCurrentLine(line:number) {

    var addCurrentMarker = (line:number) => {
      var div = document.createElement("div");
      div.style.color = '#66ffff';
      div.appendChild(document.createTextNode("\u25b6"));
      this.editor.setGutterMarker(line, "gutter-info", div);
    }

    this.clearCurrentLine();
    if (line>0) {
      addCurrentMarker(line-1);
      this.editor.setSelection({line:line,ch:0}, {line:line-1,ch:0}, {scroll:true});
      this.currentDebugLine = line;
    }
  }

  clearCurrentLine() {
    if (this.currentDebugLine) {
      this.editor.clearGutter("gutter-info");
      this.editor.setSelection(this.editor.getCursor());
      this.currentDebugLine = 0;
    }
  }
  
  refreshDebugState() {
    this.clearCurrentLine();
    var state = lastDebugState;
    if (state && state.c) {
      var PC = state.c.PC;
      var line = this.sourcefile.findLineForOffset(PC);
      if (line >= 0) {
        this.setCurrentLine(line);
        // TODO: switch to disasm?
      }
    }
  }
  
  refreshListing() {
    if (!this.dirtylisting) return;
    this.dirtylisting = false;
    var lst = current_project.getListingForFile(this.path);
    if (lst && lst.sourcefile) {
      this.updateListing(lst.sourcefile); // updates sourcefile variable
    }
  }

  refresh() {
    this.refreshListing();
    this.refreshDebugState();
  }
  
  getLine(line : number) {
    return this.editor.getLine(line-1);
  }
  
  getCurrentLine() : number {
    return this.editor.getCursor().line+1;
  }
  
  getCursorPC() : number {
    var line = this.getCurrentLine();
    while (this.sourcefile && line >= 0) {
      var pc = this.sourcefile.line2offset[line];
      if (pc >= 0) return pc;
      line--;
    }
    return -1;
  }

  // bitmap editor (TODO: refactor)

  openBitmapEditorWithParams(fmt, bytestr, palfmt, palstr) {

    var handleWindowMessage = (e) => { 
      //console.log("window message", e.data);
      if (e.data.bytes) {
        this.editor.replaceSelection(e.data.bytestr);
      }
      if (e.data.close) {
        $("#pixeditback").hide();
      }
    }

    $("#pixeditback").show();
    window.addEventListener("message", handleWindowMessage, false); // TODO: remove listener
    window['pixeditframe'].contentWindow.postMessage({fmt:fmt, bytestr:bytestr, palfmt:palfmt, palstr:palstr}, '*');
  }

  lookBackwardsForJSONComment(line, req) {
    var re = /[/;][*;]([{].+[}])[*;][/;]/;
    while (--line >= 0) {
      var s = this.editor.getLine(line);
      var m = re.exec(s);
      if (m) {
        var jsontxt = m[1].replace(/([A-Za-z]+):/g, '"$1":'); // fix lenient JSON
        var obj = JSON.parse(jsontxt);
        if (obj[req]) {
          var start = {obj:obj, line:line, ch:s.indexOf(m[0])+m[0].length};
          var line0 = line;
          var pos0 = start.ch;
          line--;
          while (++line < this.editor.lineCount()) {
            var l = this.editor.getLine(line);
            var endsection;
            if (platform_id == 'verilog')
              endsection = l.indexOf('end') >= pos0;
            else
              endsection = l.indexOf(';') >= pos0;
            if (endsection) {
              var end = {line:line, ch:this.editor.getLine(line).length};
              return {obj:obj, start:start, end:end};
            }
            pos0 = 0;
          }
          line = line0;
        }
      }
    }
  }

  openBitmapEditorAtCursor() {
    if ($("#pixeditback").is(":visible")) {
      $("#pixeditback").hide(250);
      return;
    }
    var line = this.editor.getCursor().line + 1;
    var data = this.lookBackwardsForJSONComment(this.getCurrentLine(), 'w');
    if (data && data.obj && data.obj.w>0 && data.obj.h>0) {
      var paldata = this.lookBackwardsForJSONComment(data.start.line-1, 'pal');
      var palbytestr;
      if (paldata) {
        palbytestr = this.editor.getRange(paldata.start, paldata.end);
        paldata = paldata.obj;
      }
      this.editor.setSelection(data.end, data.start);
      this.openBitmapEditorWithParams(data.obj, this.editor.getSelection(), paldata, palbytestr);
    } else {
      alert("To edit graphics, move cursor to a constant array preceded by a comment in the format:\n\n/*{w:,h:,bpp:,count:...}*/\n\n(See code examples)");
    }
  }
}

///

export class DisassemblerView implements ProjectView {
  disasmview;
  
  getDisasmView() { return this.disasmview; }
 
  createDiv(parent : HTMLElement) {
    var div = document.createElement('div');
    div.setAttribute("class", "editor");
    parent.appendChild(div);
    this.newEditor(div);
    return div;
  }
  
  newEditor(parent : HTMLElement) {
    this.disasmview = CodeMirror(parent, {
      mode: 'z80', // TODO: pick correct one
      theme: 'cobalt',
      tabSize: 8,
      readOnly: true,
      styleActiveLine: true
    });
  }

  // TODO: too many globals
  refresh() {
    var state = lastDebugState || platform.saveState();
    var pc = state.c ? state.c.PC : 0;
    var curline = 0;
    var selline = 0;
    // TODO: not perfect disassembler
    var disassemble = (start, end) => {
      if (start < 0) start = 0;
      if (end > 0xffff) end = 0xffff;
      // TODO: use pc2visits
      var a = start;
      var s = "";
      while (a < end) {
        var disasm = platform.disassemble(a, platform.readAddress);
        /* TODO: look thru all source files
        var srclinenum = sourcefile && this.sourcefile.offset2line[a];
        if (srclinenum) {
          var srcline = getActiveEditor().getLine(srclinenum);
          if (srcline && srcline.trim().length) {
            s += "; " + srclinenum + ":\t" + srcline + "\n";
            curline++;
          }
        }
        */
        var bytes = "";
        for (var i=0; i<disasm.nbytes; i++)
          bytes += hex(platform.readAddress(a+i));
        while (bytes.length < 14)
          bytes += ' ';
        var dline = hex(parseInt(a)) + "\t" + bytes + "\t" + disasm.line + "\n";
        s += dline;
        if (a == pc) selline = curline;
        curline++;
        a += disasm.nbytes || 1;
      }
      return s;
    }
    var text = disassemble(pc-96, pc) + disassemble(pc, pc+96);
    this.disasmview.setValue(text);
    this.disasmview.setCursor(selline, 0);
    jumpToLine(this.disasmview, selline);
  }

  getCursorPC() : number {
    var line = this.disasmview.getCursor().line;
    if (line >= 0) {
      var toks = this.disasmview.getLine(line).split(/\s+/);
      if (toks && toks.length >= 1) {
        var pc = parseInt(toks[0], 16);
        if (pc >= 0) return pc;
      }
    }
    return -1;
  }
}

///

export class ListingView extends DisassemblerView implements ProjectView {
  assemblyfile : SourceFile;

  constructor(assemblyfile : SourceFile) {
    super();
    this.assemblyfile = assemblyfile;
  }

  refresh() {
    var state = lastDebugState || platform.saveState();
    var pc = state.c ? state.c.PC : 0;
    var asmtext = this.assemblyfile.text;
    var disasmview = this.getDisasmView();
    if (platform_id == 'base_z80') { // TODO
      asmtext = asmtext.replace(/[ ]+\d+\s+;.+\n/g, '');
      asmtext = asmtext.replace(/[ ]+\d+\s+.area .+\n/g, '');
    }
    disasmview.setValue(asmtext);
    var findPC = platform.getDebugCallback() ? pc : -1;
    if (findPC >= 0) {
      var lineno = this.assemblyfile.findLineForOffset(findPC);
      if (lineno) {
        // set cursor while debugging
        if (platform.getDebugCallback())
          disasmview.setCursor(lineno-1, 0);
        jumpToLine(disasmview, lineno-1);
      }
    }
  }
}

///

export class MemoryView implements ProjectView {
  memorylist;
  dumplines;
  maindiv : HTMLElement;
  static IGNORE_SYMS = {s__INITIALIZER:true, /* s__GSINIT:true, */ _color_prom:true};

  createDiv(parent : HTMLElement) {
    var div = document.createElement('div');
    div.setAttribute("class", "memdump");
    parent.appendChild(div);
    this.showMemoryWindow(div);
    return this.maindiv = div;
  }

  showMemoryWindow(parent : HTMLElement) {
    this.memorylist = new VirtualList({
      w:$("#workspace").width(),
      h:$("#workspace").height(),
      itemHeight: getVisibleEditorLineHeight(),
      totalRows: 0x1000,
      generatorFn: (row : number) => {
        var s = this.getMemoryLineAt(row);
        var linediv = document.createElement("div");
        if (this.dumplines) {
          var dlr = this.dumplines[row];
          if (dlr) linediv.classList.add('seg_' + this.getMemorySegment(this.dumplines[row].a));
        }
        linediv.appendChild(document.createTextNode(s));
        return linediv;
      }
    });
    $(parent).append(this.memorylist.container);
    this.tick();
    if (compparams && this.dumplines)
      this.memorylist.scrollToItem(this.findMemoryWindowLine(compparams.data_start));
  }
  
  refresh() {
    this.tick();
  }
  
  tick() {
    if (this.memorylist) {
      $(this.maindiv).find('[data-index]').each( (i,e) => {
        var div = $(e);
        var row = parseInt(div.attr('data-index'));
        var oldtext = div.text();
        var newtext = this.getMemoryLineAt(row);
        if (oldtext != newtext)
          div.text(newtext);
      });
    }
  }

  getMemoryLineAt(row : number) : string {
    var offset = row * 16;
    var n1 = 0;
    var n2 = 16;
    var sym;
    if (this.getDumpLines()) {
      var dl = this.dumplines[row];
      if (dl) {
        offset = dl.a & 0xfff0;
        n1 = dl.a - offset;
        n2 = n1 + dl.l;
        sym = dl.s;
      } else {
        return '.';
      }
    }
    var s = hex(offset,4) + ' ';
    for (var i=0; i<n1; i++) s += '   ';
    if (n1 > 8) s += ' ';
    for (var i=n1; i<n2; i++) {
      var read = platform.readAddress(offset+i);
      if (i==8) s += ' ';
      s += ' ' + (read>=0?hex(read,2):'??');
    }
    for (var i=n2; i<16; i++) s += '   ';
    if (sym) s += '  ' + sym;
    return s;
  }

  getDumpLineAt(line : number) {
    var d = this.dumplines[line];
    if (d) {
      return d.a + " " + d.s;
    }
  }

  // TODO: addr2symbol for ca65; and make it work without symbols
  getDumpLines() {
    if (!this.dumplines && addr2symbol) {
      this.dumplines = [];
      var ofs = 0;
      var sym;
      for (const _nextofs of Object.keys(addr2symbol)) { 
        var nextofs = parseInt(_nextofs); // convert from string (stupid JS)
        var nextsym = addr2symbol[nextofs];
        if (sym) {
          if (MemoryView.IGNORE_SYMS[sym]) {
            ofs = nextofs;
          } else {
            while (ofs < nextofs) {
              var ofs2 = (ofs + 16) & 0xffff0;
              if (ofs2 > nextofs) ofs2 = nextofs;
              //if (ofs < 1000) console.log(ofs, ofs2, nextofs, sym);
              this.dumplines.push({a:ofs, l:ofs2-ofs, s:sym});
              ofs = ofs2;
            }
          }
        }
        sym = nextsym;
      }
    }
    return this.dumplines;
  }

  getMemorySegment(a:number) : string {
    if (!compparams) return 'unknown';
    if (a >= compparams.data_start && a < compparams.data_start+compparams.data_size) {
      if (platform.getSP && a >= platform.getSP() - 15)
        return 'stack';
      else
        return 'data';
    }
    else if (a >= compparams.code_start && a < compparams.code_start+compparams.code_size)
      return 'code';
    else
      return 'unknown';
  }

  findMemoryWindowLine(a:number) : number {
    for (var i=0; i<this.dumplines.length; i++)
      if (this.dumplines[i].a >= a)
        return i;
  }
}
