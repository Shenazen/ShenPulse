"use strict";

/** Client de diagnostic commun aux scripts historiques de vérification Electron. Ne démarre aucune application. */
const http = require("node:http");
const WebSocket = require("ws");

function jsonRequest(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (response) => {
      let body = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => {
        body += chunk;
      });
      response.on("end", () => {
        try {
          resolve(JSON.parse(body));
        } catch (error) {
          reject(error);
        }
      });
    }).on("error", reject);
  });
}

function connect(url) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url);
    const pending = new Map();
    let sequence = 0;
    socket.once("error", reject);
    socket.once("open", () => {
      resolve({
        call(method, params = {}) {
          return new Promise((callResolve, callReject) => {
            sequence += 1;
            pending.set(sequence, { resolve: callResolve, reject: callReject });
            socket.send(JSON.stringify({ id: sequence, method, params }));
          });
        },
        close() {
          socket.close();
        },
        evaluate(expression, awaitPromise = false) {
          return this.call("Runtime.evaluate", {
            awaitPromise,
            expression,
            returnByValue: true,
            userGesture: true
          }).then((response) => {
            if (response.exceptionDetails) {
              throw new Error(
                response.exceptionDetails.exception?.description ||
                response.exceptionDetails.text ||
                "Évaluation Electron impossible."
              );
            }
            return response.result?.value;
          });
        }
      });
    });
    socket.on("message", (payload) => {
      const message = JSON.parse(String(payload));
      if (!message.id || !pending.has(message.id)) return;
      const request = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) request.reject(new Error(message.error.message));
      else request.resolve(message.result);
    });
  });
}

module.exports = { jsonRequest, connect };

