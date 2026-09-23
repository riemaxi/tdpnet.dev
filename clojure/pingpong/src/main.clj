(ns main
  (:require [system :as sys]
            [tdpnet :as tdp]
            [gniazdo.core :as ws])
  (:gen-class))

(def config
  {:ponpin {:host "ws://213.199.58.37:5000"
            :credential {:accesskey "PONPIN"
                         :password "000000"
                         :address "samuel.aladino.maya.4da"
                         :context {}}
            :peers {:pinpon "pinpon.aladino.maya.4da"}}})

(defn delayed-task [delay-ms task-fn]
  (future
    (Thread/sleep delay-ms)
    (task-fn)))

(defn -main [& _args]
  (println "Starting TDPnet Application...")
  (let [sys-config (get config :ponpin)
        address (get-in sys-config [:credential :address])
        peer-target (get-in sys-config [:peers :pinpon])
        socket-ref (atom nil)

        handlers
        {:on-denied
         (fn [data]
           (println "denied" data))

         :on-granted
         (fn [data]
           (println "granted" data)
           (tdp/request! @socket-ref {:from address
                                      :to peer-target
                                      :id "ping"
                                      :data 0}))

         :on-event
         (fn [id-val packet]
           (let [to (get-in packet [:peering :from])]
             (println "event" id-val to (System/currentTimeMillis))
             (when (= id-val "ping")
               (delayed-task 2000
                             #(tdp/notify! @socket-ref {:from address
                                                        :to to
                                                        :id "pong"
                                                        :data 0})))))

         :on-response
         (fn [id-val packet]
           (println "response" id-val (System/currentTimeMillis))
           (when (= id-val "pong")
             (delayed-task 2000
                           #(tdp/response! @socket-ref {:packet packet
                                                        :id "ping"
                                                        :data 1}))))

         :on-request
         (fn [id-val packet]
           (println "request" id-val (System/currentTimeMillis))
           (when (= id-val "pong")
             (delayed-task 1000
                           #(tdp/response! @socket-ref {:packet packet
                                                        :id "ping"
                                                        :data 1}))))}]

    ;; Connect and assign socket to atom immediately
    (reset! socket-ref (sys/connect-system sys-config handlers))

    ;; Close WebSocket on JVM shutdown (e.g. Ctrl+C)
    (.addShutdownHook (Runtime/getRuntime)
                      (Thread. (fn []
                                 (when-let [s @socket-ref]
                                   (ws/close s)))))

    ;; Keep main thread alive blocking indefinitely
    @(promise)))