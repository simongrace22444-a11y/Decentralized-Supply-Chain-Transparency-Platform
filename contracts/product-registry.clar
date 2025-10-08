(define-constant ERR-NOT-AUTHORIZED u100)
(define-constant ERR-INVALID-HASH u101)
(define-constant ERR-INVALID-ORIGIN u102)
(define-constant ERR-INVALID-PRODUCTION-DATE u103)
(define-constant ERR-INVALID-COMPLIANCE-DATA u104)
(define-constant ERR-PRODUCT-ALREADY-EXISTS u105)
(define-constant ERR-PRODUCT-NOT-FOUND u106)
(define-constant ERR-INVALID-TIMESTAMP u107)
(define-constant ERR-AUTHORITY-NOT-VERIFIED u108)
(define-constant ERR-INVALID-MIN-VALUE u109)
(define-constant ERR-INVALID-MAX-VALUE u110)
(define-constant ERR-UPDATE-NOT-ALLOWED u111)
(define-constant ERR-INVALID-UPDATE-PARAM u112)
(define-constant ERR-MAX-PRODUCTS-EXCEEDED u113)
(define-constant ERR-INVALID-PRODUCT-TYPE u114)
(define-constant ERR-INVALID-QUALITY-RATING u115)
(define-constant ERR-INVALID-EXPIRY-PERIOD u116)
(define-constant ERR-INVALID-LOCATION u117)
(define-constant ERR-INVALID-CURRENCY u118)
(define-constant ERR-INVALID-STATUS u119)
(define-constant ERR-INVALID-BATCH-SIZE u120)

(define-data-var next-product-id uint u0)
(define-data-var max-products uint u10000)
(define-data-var registration-fee uint u500)
(define-data-var authority-contract (optional principal) none)

(define-map products
  uint
  {
    hash: (buff 32),
    origin: (string-ascii 100),
    production-date: uint,
    compliance-data: (string-ascii 200),
    timestamp: uint,
    producer: principal,
    product-type: (string-ascii 50),
    quality-rating: uint,
    expiry-period: uint,
    location: (string-ascii 100),
    currency: (string-ascii 20),
    status: bool,
    min-value: uint,
    max-value: uint,
    batch-size: uint
  }
)

(define-map products-by-hash
  (buff 32)
  uint)

(define-map product-updates
  uint
  {
    update-origin: (string-ascii 100),
    update-production-date: uint,
    update-compliance-data: (string-ascii 200),
    update-timestamp: uint,
    updater: principal
  }
)

(define-read-only (get-product (id uint))
  (map-get? products id)
)

(define-read-only (get-product-updates (id uint))
  (map-get? product-updates id)
)

(define-read-only (is-product-registered (hash (buff 32)))
  (is-some (map-get? products-by-hash hash))
)

(define-private (validate-hash (hash (buff 32)))
  (if (is-eq (len hash) u32)
      (ok true)
      (err ERR-INVALID-HASH))
)

(define-private (validate-origin (origin (string-ascii 100)))
  (if (and (> (len origin) u0) (<= (len origin) u100))
      (ok true)
      (err ERR-INVALID-ORIGIN))
)

(define-private (validate-production-date (date uint))
  (if (> date u0)
      (ok true)
      (err ERR-INVALID-PRODUCTION-DATE))
)

(define-private (validate-compliance-data (data (string-ascii 200)))
  (if (<= (len data) u200)
      (ok true)
      (err ERR-INVALID-COMPLIANCE-DATA))
)

(define-private (validate-timestamp (ts uint))
  (if (>= ts block-height)
      (ok true)
      (err ERR-INVALID-TIMESTAMP))
)

(define-private (validate-product-type (type (string-ascii 50)))
  (if (or (is-eq type "organic") (is-eq type "manufactured") (is-eq type "processed"))
      (ok true)
      (err ERR-INVALID-PRODUCT-TYPE))
)

(define-private (validate-quality-rating (rating uint))
  (if (<= rating u100)
      (ok true)
      (err ERR-INVALID-QUALITY-RATING))
)

(define-private (validate-expiry-period (period uint))
  (if (> period u0)
      (ok true)
      (err ERR-INVALID-EXPIRY-PERIOD))
)

(define-private (validate-location (loc (string-ascii 100)))
  (if (and (> (len loc) u0) (<= (len loc) u100))
      (ok true)
      (err ERR-INVALID-LOCATION))
)

(define-private (validate-currency (cur (string-ascii 20)))
  (if (or (is-eq cur "STX") (is-eq cur "USD") (is-eq cur "BTC"))
      (ok true)
      (err ERR-INVALID-CURRENCY))
)

(define-private (validate-min-value (min uint))
  (if (> min u0)
      (ok true)
      (err ERR-INVALID-MIN-VALUE))
)

(define-private (validate-max-value (max uint))
  (if (> max u0)
      (ok true)
      (err ERR-INVALID-MAX-VALUE))
)

(define-private (validate-batch-size (size uint))
  (if (> size u0)
      (ok true)
      (err ERR-INVALID-BATCH-SIZE))
)

(define-private (validate-principal (p principal))
  (if (not (is-eq p 'SP000000000000000000002Q6VF78))
      (ok true)
      (err ERR-NOT-AUTHORIZED))
)

(define-public (set-authority-contract (contract-principal principal))
  (begin
    (try! (validate-principal contract-principal))
    (asserts! (is-none (var-get authority-contract)) (err ERR-AUTHORITY-NOT-VERIFIED))
    (var-set authority-contract (some contract-principal))
    (ok true)
  )
)

(define-public (set-max-products (new-max uint))
  (begin
    (asserts! (> new-max u0) (err ERR-MAX-PRODUCTS-EXCEEDED))
    (asserts! (is-some (var-get authority-contract)) (err ERR-AUTHORITY-NOT-VERIFIED))
    (var-set max-products new-max)
    (ok true)
  )
)

(define-public (set-registration-fee (new-fee uint))
  (begin
    (asserts! (>= new-fee u0) (err ERR-INVALID-UPDATE-PARAM))
    (asserts! (is-some (var-get authority-contract)) (err ERR-AUTHORITY-NOT-VERIFIED))
    (var-set registration-fee new-fee)
    (ok true)
  )
)

(define-public (register-product
  (hash (buff 32))
  (origin (string-ascii 100))
  (production-date uint)
  (compliance-data (string-ascii 200))
  (product-type (string-ascii 50))
  (quality-rating uint)
  (expiry-period uint)
  (location (string-ascii 100))
  (currency (string-ascii 20))
  (min-value uint)
  (max-value uint)
  (batch-size uint)
)
  (let (
        (next-id (var-get next-product-id))
        (current-max (var-get max-products))
        (authority (var-get authority-contract))
      )
    (asserts! (< next-id current-max) (err ERR-MAX-PRODUCTS-EXCEEDED))
    (try! (validate-hash hash))
    (try! (validate-origin origin))
    (try! (validate-production-date production-date))
    (try! (validate-compliance-data compliance-data))
    (try! (validate-product-type product-type))
    (try! (validate-quality-rating quality-rating))
    (try! (validate-expiry-period expiry-period))
    (try! (validate-location location))
    (try! (validate-currency currency))
    (try! (validate-min-value min-value))
    (try! (validate-max-value max-value))
    (try! (validate-batch-size batch-size))
    (asserts! (is-none (map-get? products-by-hash hash)) (err ERR-PRODUCT-ALREADY-EXISTS))
    (let ((authority-recipient (unwrap! authority (err ERR-AUTHORITY-NOT-VERIFIED))))
      (try! (stx-transfer? (var-get registration-fee) tx-sender authority-recipient))
    )
    (map-set products next-id
      {
        hash: hash,
        origin: origin,
        production-date: production-date,
        compliance-data: compliance-data,
        timestamp: block-height,
        producer: tx-sender,
        product-type: product-type,
        quality-rating: quality-rating,
        expiry-period: expiry-period,
        location: location,
        currency: currency,
        status: true,
        min-value: min-value,
        max-value: max-value,
        batch-size: batch-size
      }
    )
    (map-set products-by-hash hash next-id)
    (var-set next-product-id (+ next-id u1))
    (print { event: "product-registered", id: next-id })
    (ok next-id)
  )
)

(define-public (update-product
  (product-id uint)
  (update-origin (string-ascii 100))
  (update-production-date uint)
  (update-compliance-data (string-ascii 200))
)
  (let ((product (map-get? products product-id)))
    (match product
      p
        (begin
          (asserts! (is-eq (get producer p) tx-sender) (err ERR-NOT-AUTHORIZED))
          (try! (validate-origin update-origin))
          (try! (validate-production-date update-production-date))
          (try! (validate-compliance-data update-compliance-data))
          (map-set products product-id
            {
              hash: (get hash p),
              origin: update-origin,
              production-date: update-production-date,
              compliance-data: update-compliance-data,
              timestamp: block-height,
              producer: (get producer p),
              product-type: (get product-type p),
              quality-rating: (get quality-rating p),
              expiry-period: (get expiry-period p),
              location: (get location p),
              currency: (get currency p),
              status: (get status p),
              min-value: (get min-value p),
              max-value: (get max-value p),
              batch-size: (get batch-size p)
            }
          )
          (map-set product-updates product-id
            {
              update-origin: update-origin,
              update-production-date: update-production-date,
              update-compliance-data: update-compliance-data,
              update-timestamp: block-height,
              updater: tx-sender
            }
          )
          (print { event: "product-updated", id: product-id })
          (ok true)
        )
      (err ERR-PRODUCT-NOT-FOUND)
    )
  )
)

(define-public (get-product-count)
  (ok (var-get next-product-id))
)

(define-public (check-product-existence (hash (buff 32)))
  (ok (is-product-registered hash))
)