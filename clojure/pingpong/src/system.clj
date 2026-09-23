(ns system
  (:require [tdpnet :as tdp]
            [gniazdo.core :as ws]
            [cheshire.core :as json]))

(defn connect-system [config handlers]
  (let [host (get config :host)
        credential (get config :credential {})
        
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
                           :on-receive on-msg
                           :on-close (fn [code reason]
                                       (println "WebSocket Closed:" code reason))
                           :on-error (fn [e] 
                                       (println "WebSocket Error:" (.getMessage e))))]
    
    ;; Send signin payload now that socket instance is assigned
    (tdp/send-json! socket "signin" credential)
    socket))