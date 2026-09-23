(ns tdpnet
  (:require [cheshire.core :as json]
            [clojure.string :as str]
            [gniazdo.core :as ws]))

;; ==========================================
;; PACKET PARSING FIXES
;; ==========================================

(defn hex->bytes [hex-str]
  (if (or (nil? hex-str) (empty? hex-str))
    (byte-array 0)
    (let [padded (if (odd? (count hex-str)) (str "0" hex-str) hex-str)]
      (byte-array
       (map #(unchecked-byte (Integer/parseInt % 16))
            (map #(apply str %) (partition 2 padded)))))))

(defn bytes->hex [bytes-arr]
  (apply str (map #(format "%02X" %) bytes-arr)))

(defn channel-from-string [s]
  (let [parts (str/split (or s "") #"\|")
        path-str (get parts 0 "")
        layer (get parts 1 "0")
        signal (get parts 2 "0")]
    {:path (hex->bytes path-str)
     :layer (Long/parseLong layer)
     :signal (Long/parseLong signal)}))

(defn channel->string [{:keys [path layer signal]}]
  (str (bytes->hex path) "|" layer "|" signal))

(defn status-from-string [s]
  (let [parts (str/split (or s "") #"\|")
        age (get parts 0 "0")
        health (get parts 1 "0000")]
    {:age (Long/parseLong age)
     :health health}))

(defn status->string [{:keys [age health]}]
  (str age "|" health))

(defn peering-from-string [s]
  (let [parts (str/split (or s "") #" ")
        ts (get parts 0 "0")
        from-peer (get parts 1 "")
        to-peer (get parts 2 "")
        subject (get parts 3 "")]
    {:timestamp (Long/parseLong ts)
     :from from-peer
     :to to-peer
     :subject subject}))

(defn peering->string [{:keys [timestamp from to subject]}]
  (str timestamp " " from " " to " " subject))

(defn transformer-from-strings [lines]
  (let [meta-line (or (first lines) "0|0")
        data-lines (rest lines)
        [ptr-str ops-str] (str/split meta-line #"\|")
        ops (if (or (nil? ops-str) (empty? ops-str))
              [0]
              (map #(Long/parseLong %) (filter #(not (empty? %)) (str/split ops-str #","))))]
    {:pointer (Long/parseLong (or ptr-str "0"))
     :operators (byte-array ops)
     :data (str/join "\n" data-lines)}))

(defn transformer->string [{:keys [pointer operators data]}]
  (let [ops-str (str/join "," (map #(int %) operators))]
    (str pointer "|" ops-str "\n" data)))

(defn packet-from-string [s]
  (let [lines (str/split-lines (or s ""))]
    {:channel (channel-from-string (get lines 0 ""))
     :status (status-from-string (get lines 1 ""))
     :peering (peering-from-string (get lines 2 ""))
     :transformer (transformer-from-strings (drop 3 lines))}))

(defn packet->string [packet]
  (str/join "\n" [(channel->string (:channel packet))
                  (status->string (:status packet))
                  (peering->string (:peering packet))
                  (transformer->string (:transformer packet))]))

;; ==========================================
;; MESSAGING HELPERS
;; ==========================================

(defn create-signal [{:keys [from to subject data operators pointer]
                      :or {operators (byte-array [0]) pointer 0}}]
  (packet->string
   {:channel {:path (byte-array 0) :layer 0 :signal 1}
    :status {:age 0 :health "0000"}
    :peering {:timestamp (System/currentTimeMillis)
              :from from
              :to to
              :subject subject}
    :transformer {:pointer pointer
                  :operators operators
                  :data data}}))

(defn send-json! [socket id-val data]
  (ws/send-msg socket (json/generate-string {:id id-val :data data})))

(defn send-signal! [socket data]
  (send-json! socket "signal" data))

(defn send-data! [socket data]
  (send-json! socket "data" data))

(defn request! [socket {:keys [from to id data]}]
  (let [packet (create-signal {:from from
                               :to to
                               :subject (str "request:" id)
                               :data (json/generate-string data)})]
    (send-signal! socket packet)))

(defn response! [socket {:keys [packet id data]}]
  (let [updated-peering {:timestamp (System/currentTimeMillis)
                         :from (get-in packet [:peering :to])
                         :to (get-in packet [:peering :from])
                         :subject (str "response:" id)}
        updated-packet (-> packet
                           (assoc :peering updated-peering)
                           (assoc-in [:transformer :data] (json/generate-string data))
                           (assoc-in [:channel :signal] 0))]
    (send-data! socket (packet->string updated-packet))))

(defn notify! [socket {:keys [from to id data]}]
  (let [packet (create-signal {:from from
                               :to to
                               :subject (str "event:" id)
                               :data (json/generate-string data)})]
    (send-signal! socket packet)))

(defn handle-packet [handlers packet]
  (let [subject (get-in packet [:peering :subject])
        [category id-val] (str/split (or subject "") #":" 2)]
    (case category
      "request"  (when-let [f (:on-request handlers)] (f id-val packet))
      "response" (when-let [f (:on-response handlers)] (f id-val packet))
      "event"    (when-let [f (:on-event handlers)] (f id-val packet))
      nil)))