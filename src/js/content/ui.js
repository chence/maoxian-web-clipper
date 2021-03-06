
"use strict";

this.UI = (function(){
  const state = { clippingState: 'idle' };

  // ifarme common functions

  function appendIframe(){
    this.element = initializeIframe(this.src());
    this.element.id = this.id;
    this.appendExtraStyle();
    this.element.addEventListener('load', () => {
      this.frameLoaded();
    });
    document.body.appendChild(this.element);
    Log.debug(this.id, 'append');
  }

  function removeIframe(){
    this.ready = false;
    if(this.element){
      document.body.removeChild(this.element);
      this.element = null;
      Log.debug(this.id, 'removed');
    }
  }

  // selection layer
  const selectionIframe = {
    id: 'mx-wc-iframe-selection',
    ready: false,
    src: function(){
      const url =  ExtApi.getURL('/pages/ui-selection.html');
      return url + "?t=" + btoa(window.location.origin)
    },
    append: appendIframe,
    appendExtraStyle: function(){
      this.element.style.zIndex = "2147483646";
      this.element.style.setProperty("position", "absolute", "important");
      this.element = updateFrameSize(this.element);
    },
    remove: removeIframe,
    frameLoaded: function(){
      this.ready = true;
      dispatchFrameLoadedEvent(this.id);
    }
  }

  // status & form layer
  const controlIframe = {
    id: 'mx-wc-iframe-control',
    ready: false,
    src: function(){
      const url =  ExtApi.getURL('/pages/ui-control.html');
      return url + "?t=" + btoa(window.location.origin)
    },
    append: appendIframe,
    appendExtraStyle: function(){
      this.element.style.height = '100%';
      this.element.style.zIndex = "2147483647";
      this.element.style.setProperty("position", "fixed", "important");
    },
    remove: removeIframe,
    frameLoaded: function(){
      this.element.focus();
      this.ready = true;
      dispatchFrameLoadedEvent(this.id);
    }
  }

  function dispatchFrameLoadedEvent(frameId) {
    Log.debug(frameId, 'loaded');
    if(selectionIframe.ready && controlIframe.ready) {
      Log.debug('all-iframe-loaded');
      const ev = new CustomEvent('all-iframe-loaded');
      document.dispatchEvent(ev);
    }
  }


  function initializeIframe(src) {
    let el = document.createElement("iframe");
    el.src = src;
    el.style.zIndex = "99999999999";
    el.style.border = "none";
    el.style.top = "0";
    el.style.left = "0";
    el.style.margin = "0";
    el.style.width = '100%';
    el.style.clip = "auto";
    el.scrolling = "no";
    el.style.setProperty("background-color", "transparent");
    return el;
  }

  // append UI layers
  function append(){
    remove();
    selectionIframe.append();
    controlIframe.append();
    Log.debug("UI appened");
  }

  // remove UI layers
  function remove(){
    controlIframe.remove();
    selectionIframe.remove();
    state.currElem = null;
    Log.debug("UI remove");
  }


  function updateFrameSize(frame){
    if(frame){
      const height = Math.max(
        document.documentElement.clientHeight,
        document.body.clientHeight,
        document.documentElement.scrollHeight,
        document.body.scrollHeight
      );
      frame.style.height = height + 'px';
    }
    return frame;
  }

  function windowSizeChanged(){
    if(selectionIframe.element){
      selectionIframe.element = updateFrameSize(selectionIframe.element);
      if(state.clippingState === 'selecting' && state.currElem){
        drawSelectingStyle(state.currElem);
      }
      if(state.clippingState === 'selected' && state.currElem){
        drawSelectedStyle(state.currElem);
      }
    }
  }

  function mouseMove(msg) {
    try {
      const elem = getElementFromPoint(msg.x, msg.y);
      if(state.currElem && state.currElem == elem){
        // event trigger in same element
        return;
      }
      state.currElem = elem;
      drawSelectingStyle(elem);
    } catch(e) {
      Log.error(e);
    }
  }

  function isEventInCurrElem(msg){
    if(state.currElem){
      const x = msg.x + window.scrollX;
      const y = msg.y + window.scrollY;
      const box = getBox(state.currElem);
      return (
         box.x <= x && x <= box.x + box.w
      && box.y <= y && y <= box.y + box.h
      );
    } else {
      return false;
    }
  }

  /*
   *  x => x relative to page
   *  y => y relative to page
   *  w => width of elem box
   *  h => height of elem box
   */
  function getBox(elem){
    const box = elem.getBoundingClientRect();
    return {
      x: window.scrollX + box.left,
      y: window.scrollY + box.top,
      w: box.width,
      h: box.height
    }
  }


  function getElementFromPoint(x, y) {
    selectionIframe.element.style.pointerEvents = 'none';
    controlIframe.element.style.pointerEvents = 'none';
    let el;
    try {
      el = document.elementFromPoint(x, y);
      el = getOutermostWrapper(el);
    } finally {
      selectionIframe.element.style.pointerEvents = '';
      controlIframe.element.style.pointerEvents = '';
    }
    return el;
  }


  // TODO changeNameHere
  function cancelForm(msg){
    disable();
    remove();
  }

  function hideForm(){
    sendFrameMsgToControl('hideForm');
  }
  function setStateIdle(){
    state.clippingState = 'idle';
    sendFrameMsgToControl('setStateIdle');
    dispatchMxEvent('idle');
  }
  function setStateSelecting(){
    state.clippingState = 'selecting';
    sendFrameMsgToControl('setStateSelecting');
    dispatchMxEvent('selecting');
  }
  function setStateSelected(){
    state.clippingState = 'selected';
    sendFrameMsgToControl('setStateSelected');
    dispatchMxEvent('selected');
  }
  function setStateConfirmed(){
    state.clippingState = 'confirmed';
    sendFrameMsgToControl('setStateConfirmed');
    dispatchMxEvent('confirmed');
  }
  function setStateClipping(){
    state.clippingState = 'clipping';
    sendFrameMsgToControl('setStateClipping');
    dispatchMxEvent('clipping');
  }
  function drawSelectingStyle(elem){
    sendFrameMsgToSelection('drawRect', {box: getBox(elem), color: 'red'});
  }
  function drawSelectedStyle(elem){
    sendFrameMsgToSelection('drawRect', {box: getBox(elem), color: 'green'});
  }
  function eraseHigtlightStyle(){
    sendFrameMsgToSelection('eraseRect');
  }

  function sendFrameMsgToControl(type, msg) {
    FrameMsg.send({to: controlIframe.id, type: type, msg: (msg || {})});
  }

  function sendFrameMsgToSelection(type, msg) {
    FrameMsg.send({to: selectionIframe.id, type: type, msg: (msg || {})});
  }

  function dispatchMxEvent(name, data) {
    const eventName = ['mx-wc', name].join('.');
    const e = new CustomEvent(eventName, {detail: (data || {})});
    document.dispatchEvent(e);
  }

  // ----------------------------
  function entryClick(e){
    if(state.clippingState === 'idle'){
      listenFrameMsg();
      T.bindOnce(document, 'all-iframe-loaded', enable)
      append();
    }else{
      ignoreFrameMsg();
      disable();
      remove();
    }
  }

  function listenFrameMsg(){
    const extFrameOrigin = (new URL(ExtApi.getURL('/'))).origin;
    FrameMsg.init({
      id: 'top',
      origin: window.location.origin,
      allowOrigins: [extFrameOrigin]
    })
    FrameMsg.addListener('mousemove'  , mouseMove);
    FrameMsg.addListener('click'      , clickHandler);
    FrameMsg.addListener('pressEsc'   , pressEsc);
    FrameMsg.addListener('pressEnter' , pressEnter);
    FrameMsg.addListener('pressLeft'  , pressLeft);
    FrameMsg.addListener('pressUp'    , pressUp);
    FrameMsg.addListener('pressRight' , pressRight);
    FrameMsg.addListener('pressDown'  , pressDown);
    FrameMsg.addListener('startClip'  , startClip);
    FrameMsg.addListener('entryClick' , entryClick);
    FrameMsg.addListener('cancelForm' , cancelForm);
    console.log('listenFrameMsg');
  }

  function startClip(msg){
    eraseHigtlightStyle();
    msg.elem = state.currElem;
    setStateClipping();
    MxWcSave.save(msg);
  }

  function ignoreFrameMsg(){
    FrameMsg.clearListener();
  }

  function enable(){
    bindListener();
    setStateSelecting();
  }

  function disable(){
    hideForm();
    unbindListener();
    setStateIdle();
  }

  function clickSelectedArea(msg){
    if(state.currElem){
      toggleScrollY(state.currElem);
    }
  }

  function switchSelected(fromElem, toElem){
    if(fromElem){
      eraseHigtlightStyle();
    }
    if(toElem){
      drawSelectedStyle(toElem);

      if(fromElem){
        // 根据前一个选中确认要滚动到顶部还是底部
        const box = fromElem.getBoundingClientRect();
        if(box.top >= 0){
          scrollToElem(toElem, 'top');
        }else{
          scrollToElem(toElem, 'bottom');
        }
      }else{
        scrollToElem(toElem, 'top');
      }
      if(state.currElem != toElem){
        state.currElem = toElem;
      }
    }
  }

  function toggleScrollY(elem){
    const box = elem.getBoundingClientRect();
    const visibleHeight = window.innerHeight;
    if(box.top + box.height > visibleHeight){
      scrollToElem(elem, 'bottom');
    }else{
      scrollToElem(elem, 'top');
    }
  }

  /*
   * @param {string} mode - 'top' or 'bottom'
   */
  function scrollToElem(elem, mode){
    const box = elem.getBoundingClientRect();
    const x = window.scrollX + box.left;
    if(mode === 'top'){
      const y = window.scrollY + box.top;
      window.scrollTo(x, Math.max(0, y-120));
    }else{
      const y = window.scrollY + box.top + box.height;
      window.scrollTo(x, Math.max(0, y-400));
    }
  }

  function bindListener(){
    sendFrameMsgToControl('bindListener');
  };

  function unbindListener(){
    sendFrameMsgToControl('unbindListener');
    eraseHigtlightStyle();
  };

  function clickHandler(msg){
    if(isEventInCurrElem(msg)){
      if(state.clippingState === 'selecting'){
        selectedTarget(state.currElem);
        return;
      }
      if(state.clippingState === 'selected'){
        clickSelectedArea(msg);
      }
    }
  }

  const MxWc = {}
  MxWc.selector = {
    clearStack: function(){
      if(this.stack){
        this.stack.clear();
      }else{
        this.stack = T.createStack();
      }
    }
  }


  function pressEsc(msg){
    if(state.clippingState === 'selected'){
      Log.debug('back');
      // 选中状态, 退回可选择状态
      disable();
      enable();
      return;
    }
    if(state.clippingState === 'selecting'){
      disable();
      remove();
    }
  }

  function pressEnter(msg){
    if(state.clippingState === 'selected'){
      sendFrameMsgToControl('showForm', {title: document.title});
    }
  }

  function pressLeft(msg){
    if(state.clippingState === 'selected'){
      const pElem = getOutermostWrapper(state.currElem.parentElement);
      if(['HTML'].indexOf(pElem.tagName) < 0){
        MxWc.selector.stack.push(state.currElem);
        switchSelected(state.currElem, pElem);
      }
    }
  }


  function pressRight(msg){
    if(state.clippingState === 'selected'){
      if(MxWc.selector.stack.isEmpty()){
        let cElem = state.currElem.children[0];
        while(cElem && (isOnBlackList(cElem) || ElemTool.isBoxSizeEq(state.currElem, cElem))){
          cElem = cElem.children[0];
        }
        if(cElem){
          MxWc.selector.clearStack();
          MxWc.selector.stack.push(cElem);
          switchSelected(state.currElem, cElem);
        }
      }else{
        let cElem = MxWc.selector.stack.pop();
        switchSelected(state.currElem, cElem);
      }
    }
  }

  function pressUp(msg){
    if(state.clippingState === 'selected'){
      let prevElem = state.currElem.previousElementSibling;
      while(prevElem && isOnBlackList(prevElem)){
        prevElem = prevElem.previousElementSibling;
      }
      if(prevElem){
        MxWc.selector.clearStack();
        switchSelected(state.currElem, prevElem);
      }
    }
  }


  function pressDown(msg){
    if(state.clippingState === 'selected'){
      let nextElem = state.currElem.nextElementSibling;
      while(nextElem && isOnBlackList(nextElem)){
        nextElem = nextElem.nextElementSibling;
      }
      if(nextElem){
        MxWc.selector.clearStack();
        switchSelected(state.currElem, nextElem);
      }
    }
  }

  function getOutermostWrapper(elem){
    if(['HTML', 'BODY'].indexOf(elem.tagName) > 0){ return elem }
    const pElem = elem.parentElement;
    if(ElemTool.isBoxSizeEq(elem, pElem) || ElemTool.isIndivisible(elem, pElem)){
      return getOutermostWrapper(pElem);
    } else {
      return elem;
    }
  }

  function isOnBlackList(elem){
    const blackList = ["SCRIPT", "STYLE", "TEMPLATE"];
    return (blackList.indexOf(elem.tagName) > -1
      || elem.tagName === 'IFRAME' && T.isExtensionUrl(elem.src)
      || elem.getBoundingClientRect().height === 0
      || elem.innerText.trim().length === 0
    )
  }

  const selectedTarget = function(target){
    sendFrameMsgToControl('unbindMouseMove');
    switchSelected(null, target);
    MxWc.selector.clearStack();
    setStateSelected();
  }

  function downloadCompleted(){
    disable();
    remove();
  }

  function focusElem(elem, callback){
    if(state.clippingState === 'idle') {
      Log.debug("[focus] State Idle...");
      entryClick({});
    }
    state.currElem = getOutermostWrapper(elem);
    if(selectionIframe.ready && controlIframe.ready) {
      Log.debug("[focus] Iframe Ready...");
      selectedTarget(state.currElem);
      if(callback){ callback()}
    } else {
      Log.debug("[focus] Iframe Loading...");
      const allIframeLoad = function(e){
        selectedTarget(state.currElem);
        if(callback){ callback()}
        T.unbind(document, 'all-iframe-loaded', allIframeLoad);
      }
      T.bind(document, 'all-iframe-loaded', allIframeLoad);
    }
  }

  function confirmElem(elem){
    focusElem(elem, function(){
      pressEnter({});
    });
  }

  /*
   * options: {:category, :tagstr}
   */
  function clipElem(elem, options){
    focusElem(elem, function(){
      startClip({
        title: (options.title || document.title),
        category: (options.category || ""),
        tagstr: (options.tagstr || "")
      });
    });
  }

  return {
    remove: remove,
    entryClick: entryClick,
    windowSizeChanged: windowSizeChanged,
    downloadCompleted: downloadCompleted,

    focusElem: focusElem,
    confirmElem: confirmElem,
    clipElem: clipElem
  }
})();
