functions=(
  "matchRequests"
  "acceptMatch"
  "rejectMatch"
  "completeMatch"
  "naverStaticMapProxy"
  "naverGeocodeProxy"
  "naverReverseGeocodeProxy"
  "naverDirectionsProxy"
  "jusoAddressSearchProxy"
  "beta1GeneratePricingQuotes"
  "beta1PlanMissionExecution"
  "beta1AnalyzeRequestDraft"
  "calculateDeliveryRate"
  "calculateDeliveryPricing"
  "confirmDeliveryReceipt"
  "saveFCMToken"
  "requestPhoneOtp"
  "confirmPhoneOtp"
  "reviewPromotion"
  "registerTaxInfo"
  "sendPushNotification"
  "startCiVerificationSession"
  "completeCiVerificationTest"
  "issueKakaoCustomToken"
  "triggerFareCacheSync"
  "syncAccountingStats"
  "ciMock"
  "ciVerificationCallback"
)

for f in "${functions[@]}"; do
  echo "Updating $f..."
  gcloud functions add-iam-policy-binding "$f" \
    --region=us-central1 \
    --member=allUsers \
    --role=roles/cloudfunctions.invoker \
    --project=ganengile > /dev/null 2>&1 &
done
wait
echo "Done!"
