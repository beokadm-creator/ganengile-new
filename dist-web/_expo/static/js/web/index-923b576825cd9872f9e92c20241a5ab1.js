__d(function(g,r,i,a,m,e,d){"use strict";Object.defineProperty(e,'__esModule',{value:!0});var t=r(d[0]);Object.keys(t).forEach(function(n){'default'===n||Object.prototype.hasOwnProperty.call(e,n)||Object.defineProperty(e,n,{enumerable:!0,get:function(){return t[n]}})})},734,[735]);
__d(function(g,r,i,a,m,_e,d){"use strict";Object.defineProperty(_e,'__esModule',{value:!0}),Object.defineProperty(_e,"FunctionsError",{enumerable:!0,get:function(){return f}}),Object.defineProperty(_e,"connectFunctionsEmulator",{enumerable:!0,get:function(){return F}}),Object.defineProperty(_e,"getFunctions",{enumerable:!0,get:function(){return U}}),Object.defineProperty(_e,"httpsCallable",{enumerable:!0,get:function(){return $}}),Object.defineProperty(_e,"httpsCallableFromURL",{enumerable:!0,get:function(){return M}});var e=r(d[0]),t=r(d[1]),n=r(d[2]);
/**
   * @license
   * Copyright 2017 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */
const o='type.googleapis.com/google.protobuf.Int64Value',s='type.googleapis.com/google.protobuf.UInt64Value';function c(e,t){const n={};for(const o in e)e.hasOwnProperty(o)&&(n[o]=t(e[o]));return n}function u(e){if(null==e)return null;if(e instanceof Number&&(e=e.valueOf()),'number'==typeof e&&isFinite(e))return e;if(!0===e||!1===e)return e;if('[object String]'===Object.prototype.toString.call(e))return e;if(e instanceof Date)return e.toISOString();if(Array.isArray(e))return e.map(e=>u(e));if('function'==typeof e||'object'==typeof e)return c(e,e=>u(e));throw new Error('Data cannot be encoded in JSON: '+e)}function l(e){if(null==e)return e;if(e['@type'])switch(e['@type']){case o:case s:{const t=Number(e.value);if(isNaN(t))throw new Error('Data cannot be decoded from JSON: '+e);return t}default:throw new Error('Data cannot be decoded from JSON: '+e)}return Array.isArray(e)?e.map(e=>l(e)):'function'==typeof e||'object'==typeof e?c(e,e=>l(e)):e}
/**
   * @license
   * Copyright 2020 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */const p='functions',h={OK:'ok',CANCELLED:'cancelled',UNKNOWN:'unknown',INVALID_ARGUMENT:'invalid-argument',DEADLINE_EXCEEDED:'deadline-exceeded',NOT_FOUND:'not-found',ALREADY_EXISTS:'already-exists',PERMISSION_DENIED:'permission-denied',UNAUTHENTICATED:'unauthenticated',RESOURCE_EXHAUSTED:'resource-exhausted',FAILED_PRECONDITION:'failed-precondition',ABORTED:'aborted',OUT_OF_RANGE:'out-of-range',UNIMPLEMENTED:'unimplemented',INTERNAL:'internal',UNAVAILABLE:'unavailable',DATA_LOSS:'data-loss'};
/**
   * @license
   * Copyright 2017 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */class f extends t.FirebaseError{constructor(e,t,n){super(`${p}/${e}`,t||''),this.details=n,Object.setPrototypeOf(this,f.prototype)}}function y(e){if(e>=200&&e<300)return'ok';switch(e){case 0:case 500:return'internal';case 400:return'invalid-argument';case 401:return'unauthenticated';case 403:return'permission-denied';case 404:return'not-found';case 409:return'aborted';case 429:return'resource-exhausted';case 499:return'cancelled';case 501:return'unimplemented';case 503:return'unavailable';case 504:return'deadline-exceeded'}return'unknown'}function k(e,t){let n,o=y(e),s=o;try{const e=t&&t.error;if(e){const t=e.status;if('string'==typeof t){if(!h[t])return new f('internal','internal');o=h[t],s=t}const c=e.message;'string'==typeof c&&(s=c),n=e.details,void 0!==n&&(n=l(n))}}catch(e){}return'ok'===o?null:new f(o,s,n)}
/**
   * @license
   * Copyright 2017 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */class w{constructor(t,n,o,s){this.app=t,this.auth=null,this.messaging=null,this.appCheck=null,this.serverAppAppCheckToken=null,(0,e._isFirebaseServerApp)(t)&&t.settings.appCheckToken&&(this.serverAppAppCheckToken=t.settings.appCheckToken),this.auth=n.getImmediate({optional:!0}),this.messaging=o.getImmediate({optional:!0}),this.auth||n.get().then(e=>this.auth=e,()=>{}),this.messaging||o.get().then(e=>this.messaging=e,()=>{}),this.appCheck||s?.get().then(e=>this.appCheck=e,()=>{})}async getAuthToken(){if(this.auth)try{const e=await this.auth.getToken();return e?.accessToken}catch(e){return}}async getMessagingToken(){if(this.messaging&&'Notification'in self&&'granted'===Notification.permission)try{return await this.messaging.getToken()}catch(e){return}}async getAppCheckToken(e){if(this.serverAppAppCheckToken)return this.serverAppAppCheckToken;if(this.appCheck){const t=e?await this.appCheck.getLimitedUseToken():await this.appCheck.getToken();return t.error?null:t.token}return null}async getContext(e){return{authToken:await this.getAuthToken(),messagingToken:await this.getMessagingToken(),appCheckToken:await this.getAppCheckToken(e)}}}
/**
   * @license
   * Copyright 2017 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */const b='us-central1',T=/^data: (.*?)(?:\n|$)/;function v(e){let t=null;return{promise:new Promise((n,o)=>{t=setTimeout(()=>{o(new f('deadline-exceeded','deadline-exceeded'))},e)}),cancel:()=>{t&&clearTimeout(t)}}}class A{constructor(e,t,n,o,s=b,c=(...e)=>fetch(...e)){this.app=e,this.fetchImpl=c,this.emulatorOrigin=null,this.contextProvider=new w(e,t,n,o),this.cancelAllRequests=new Promise(e=>{this.deleteService=()=>Promise.resolve(e())});try{const e=new URL(s);this.customDomain=e.origin+('/'===e.pathname?'':e.pathname),this.region=b}catch(e){this.customDomain=null,this.region=s}}_delete(){return this.deleteService()}_url(e){const t=this.app.options.projectId;if(null!==this.emulatorOrigin){return`${this.emulatorOrigin}/${t}/${this.region}/${e}`}return null!==this.customDomain?`${this.customDomain}/${e}`:`https://${this.region}-${t}.cloudfunctions.net/${e}`}}function E(e,n,o){const s=(0,t.isCloudWorkstation)(n);e.emulatorOrigin=`http${s?'s':''}://${n}:${o}`,s&&((0,t.pingServer)(e.emulatorOrigin+'/backends'),(0,t.updateEmulatorBanner)('Functions',!0))}function O(e,t,n){const o=o=>S(e,t,o,n||{});return o.stream=(n,o)=>j(e,t,n,o),o}function I(e,t,n){const o=o=>D(e,t,o,n||{});return o.stream=(n,o)=>R(e,t,n,o||{}),o}function C(e){return e.emulatorOrigin&&(0,t.isCloudWorkstation)(e.emulatorOrigin)?'include':void 0}async function N(e,t,n,o,s){let c;n['Content-Type']='application/json';try{c=await o(e,{method:'POST',body:JSON.stringify(t),headers:n,credentials:C(s)})}catch(e){return{status:0,json:null}}let u=null;try{u=await c.json()}catch(e){}return{status:c.status,json:u}}async function P(e,t){const n={},o=await e.contextProvider.getContext(t.limitedUseAppCheckTokens);return o.authToken&&(n.Authorization='Bearer '+o.authToken),o.messagingToken&&(n['Firebase-Instance-ID-Token']=o.messagingToken),null!==o.appCheckToken&&(n['X-Firebase-AppCheck']=o.appCheckToken),n}function S(e,t,n,o){const s=e._url(t);return D(e,s,n,o)}async function D(e,t,n,o){const s={data:n=u(n)},c=await P(e,o),p=v(o.timeout||7e4),h=await Promise.race([N(t,s,c,e.fetchImpl,e),p.promise,e.cancelAllRequests]);if(p.cancel(),!h)throw new f('cancelled','Firebase Functions instance was deleted.');const y=k(h.status,h.json);if(y)throw y;if(!h.json)throw new f('internal','Response is not valid JSON object.');let w=h.json.data;if(void 0===w&&(w=h.json.result),void 0===w)throw new f('internal','Response is missing data field.');return{data:l(w)}}function j(e,t,n,o){const s=e._url(t);return R(e,s,n,o||{})}async function R(e,t,n,o){const s={data:n=u(n)},c=await P(e,o);let l,p,h;c['Content-Type']='application/json',c.Accept='text/event-stream';try{l=await e.fetchImpl(t,{method:'POST',body:JSON.stringify(s),headers:c,signal:o?.signal,credentials:C(e)})}catch(e){if(e instanceof Error&&'AbortError'===e.name){const e=new f('cancelled','Request was cancelled.');return{data:Promise.reject(e),stream:{[Symbol.asyncIterator]:()=>({next:()=>Promise.reject(e)})}}}const t=k(0,null);return{data:Promise.reject(t),stream:{[Symbol.asyncIterator]:()=>({next:()=>Promise.reject(t)})}}}const y=new Promise((e,t)=>{p=e,h=t});o?.signal?.addEventListener('abort',()=>{const e=new f('cancelled','Request was cancelled.');h(e)});const w=_(l.body.getReader(),p,h,o?.signal);return{stream:{[Symbol.asyncIterator](){const e=w.getReader();return{async next(){const{value:t,done:n}=await e.read();return{value:t,done:n}},return:async()=>(await e.cancel(),{done:!0,value:void 0})}}},data:y}}function _(e,t,n,o){const s=(e,o)=>{const s=e.match(T);if(!s)return;const c=s[1];try{const e=JSON.parse(c);if('result'in e)return void t(l(e.result));if('message'in e)return void o.enqueue(l(e.message));if('error'in e){const t=k(0,e);return o.error(t),void n(t)}}catch(e){if(e instanceof f)return o.error(e),void n(e)}},c=new TextDecoder;return new ReadableStream({start(t){let u='';return(async function l(){if(o?.aborted){const e=new f('cancelled','Request was cancelled');return t.error(e),n(e),Promise.resolve()}try{const{value:p,done:h}=await e.read();if(h)return u.trim()&&s(u.trim(),t),void t.close();if(o?.aborted){const o=new f('cancelled','Request was cancelled');return t.error(o),n(o),void await e.cancel()}u+=c.decode(p,{stream:!0});const y=u.split('\n');u=y.pop()||'';for(const e of y)e.trim()&&s(e.trim(),t);return l()}catch(e){const o=e instanceof f?e:k(0,null);t.error(o),n(o)}})()},cancel:()=>e.cancel()})}const x="@firebase/functions",L="0.13.1";
/**
   * @license
   * Copyright 2020 Google LLC
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *   http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   */
function U(n=(0,e.getApp)(),o=b){const s=(0,e._getProvider)((0,t.getModularInstance)(n),p).getImmediate({identifier:o}),c=(0,t.getDefaultEmulatorHostnameAndPort)('functions');return c&&F(s,...c),s}function F(e,n,o){E((0,t.getModularInstance)(e),n,o)}function $(e,n,o){return O((0,t.getModularInstance)(e),n,o)}function M(e,n,o){return I((0,t.getModularInstance)(e),n,o)}var q;(0,e._registerComponent)(new n.Component(p,(e,{instanceIdentifier:t})=>{const n=e.getProvider('app').getImmediate(),o=e.getProvider("auth-internal"),s=e.getProvider("messaging-internal"),c=e.getProvider("app-check-internal");return new A(n,o,s,c,t)},"PUBLIC").setMultipleInstances(!0)),(0,e.registerVersion)(x,L,q),(0,e.registerVersion)(x,L,'esm2020')},735,[597,599,598]);