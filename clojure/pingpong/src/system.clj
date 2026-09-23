(ns system
  (:require [tdpnet :as tdp]
            [gniazdo.core :as ws]
            [cheshire.core :as json]))

(defn connect-system [config handlers]
  (let [host (get config :host)
        credential (get config :credential {})
        socket-atom (atom nil)
        
        on-msg (fn [msg-str]
                 (try
                   (let [m (json/parse-string msg-str true)
                         id-val (name (:id m))
                         data (:data m)]
                     (case id-val
                       "granted" (when-let [f (:on-granted handlers)] (f data))
                       "denied"  (when-let [f (:on-denied handlers)] (f data))
                       "signal"  (tdp/handle-packet handlers (tdp/packet-from-string data))
                       "data"    (tdp/handle-packet handlers (tdp/packet-from-string data))
                       (println "Unknown message ID:" id-val)))
                   (catch Exception e
                     (println "Error parsing message:" (.getMessage e) "Raw msg:" msg-str))))
        
        socket (ws/connect host
                           :on-connect (fn [_raw-session]
                                         ;; Send signin message via the wrapped gniazdo socket atom
                                         (when-let [s @socket-atom]
                                           (tdp/send-json! s "signin" credential)))
                           :on-receive on-msg
                           :on-close (fn [code reason]
                                       (println "WebSocket Closed:" code reason))
                           :on-error (fn [e] 
                                       (println "WebSocket Error:" (.getMessage e))))]
    (reset! socket-atom socket)
    socket))