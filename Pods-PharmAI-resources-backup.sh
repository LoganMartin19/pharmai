#!/bin/sh
export TMPDIR="/tmp"
set -e
set -u
set -o pipefail

function on_error {
  echo "$(realpath -mq "${0}"):$1: error: Unexpected failure"
}
trap 'on_error $LINENO' ERR

if [ -z ${UNLOCALIZED_RESOURCES_FOLDER_PATH+x} ]; then
  exit 0
fi

mkdir -p "${TARGET_BUILD_DIR}/${UNLOCALIZED_RESOURCES_FOLDER_PATH}"

resources_to_copy="/tmp/resources-to-copy-${TARGETNAME}.txt"
touch "$resources_to_copy" 2>/dev/null || true
: > "$resources_to_copy"

XCASSET_FILES=()

case "${TARGETED_DEVICE_FAMILY:-}" in
  1,2) TARGET_DEVICE_ARGS="--target-device ipad --target-device iphone" ;;
  1) TARGET_DEVICE_ARGS="--target-device iphone" ;;
  2) TARGET_DEVICE_ARGS="--target-device ipad" ;;
  3) TARGET_DEVICE_ARGS="--target-device tv" ;;
  4) TARGET_DEVICE_ARGS="--target-device watch" ;;
  *) TARGET_DEVICE_ARGS="--target-device mac" ;;
esac

install_resource() {
  if [[ "$1" = /* ]]; then
    RESOURCE_PATH="$1"
  else
    RESOURCE_PATH="${PODS_ROOT}/$1"
  fi

  if [[ ! -e "$RESOURCE_PATH" ]]; then
    echo "error: Resource \"$RESOURCE_PATH\" not found. Run 'pod install' to update the copy resources script."
    exit 1
  fi

  case $RESOURCE_PATH in
    *.storyboard)
      ibtool --reference-external-strings-file --errors --warnings --notices \
        --minimum-deployment-target ${!DEPLOYMENT_TARGET_SETTING_NAME} \
        --output-format human-readable-text \
        --compile "${TARGET_BUILD_DIR}/${UNLOCALIZED_RESOURCES_FOLDER_PATH}/$(basename "$RESOURCE_PATH" .storyboard).storyboardc" \
        "$RESOURCE_PATH" --sdk "${SDKROOT}" ${TARGET_DEVICE_ARGS}
      ;;
    *.xib)
      ibtool --reference-external-strings-file --errors --warnings --notices \
        --minimum-deployment-target ${!DEPLOYMENT_TARGET_SETTING_NAME} \
        --output-format human-readable-text \
        --compile "${TARGET_BUILD_DIR}/${UNLOCALIZED_RESOURCES_FOLDER_PATH}/$(basename "$RESOURCE_PATH" .xib).nib" \
        "$RESOURCE_PATH" --sdk "${SDKROOT}" ${TARGET_DEVICE_ARGS}
      ;;
    *.framework)
      echo "Copying $RESOURCE_PATH to ${TARGET_BUILD_DIR}/${FRAMEWORKS_FOLDER_PATH}" || true
      mkdir -p "${TARGET_BUILD_DIR}/${FRAMEWORKS_FOLDER_PATH}"
      cp -R "$RESOURCE_PATH" "${TARGET_BUILD_DIR}/${FRAMEWORKS_FOLDER_PATH}/"
      ;;
    *.xcdatamodel)
      xcrun momc "$RESOURCE_PATH" "${TARGET_BUILD_DIR}/${UNLOCALIZED_RESOURCES_FOLDER_PATH}/$(basename "$RESOURCE_PATH" .xcdatamodel).mom"
      ;;
    *.xcdatamodeld)
      xcrun momc "$RESOURCE_PATH" "${TARGET_BUILD_DIR}/${UNLOCALIZED_RESOURCES_FOLDER_PATH}/$(basename "$RESOURCE_PATH" .xcdatamodeld).momd"
      ;;
    *.xcmappingmodel)
      xcrun mapc "$RESOURCE_PATH" "${TARGET_BUILD_DIR}/${UNLOCALIZED_RESOURCES_FOLDER_PATH}/$(basename "$RESOURCE_PATH" .xcmappingmodel).cdm"
      ;;
    *.xcassets)
      ABSOLUTE_XCASSET_FILE="$RESOURCE_PATH"
      XCASSET_FILES+=("$ABSOLUTE_XCASSET_FILE")
      ;;
    *.bundle)
      echo "Skipping bundle from automatic copy: $RESOURCE_PATH"
      ;;
    *)
      echo "$RESOURCE_PATH" >> "$resources_to_copy"
      ;;
  esac
}

# ✅ Manual copy for problematic .bundle to avoid sandbox errors
if [[ "$CONFIGURATION" == "Debug" || "$CONFIGURATION" == "Release" ]]; then
  SRC="${PODS_CONFIGURATION_BUILD_DIR}/React-Core/AccessibilityResources.bundle"
  DEST="${TARGET_BUILD_DIR}/${UNLOCALIZED_RESOURCES_FOLDER_PATH}/AccessibilityResources.bundle"

  echo "Manually copying AccessibilityResources.bundle..."
  mkdir -p "$DEST"
  cp -R "$SRC/" "$DEST/" 2>/dev/null || true
fi

# ✅ Replace rsync with safer cp for all remaining resources
while IFS= read -r resource; do
  if [ -e "$resource" ]; then
    echo "Copying $resource to ${TARGET_BUILD_DIR}/${UNLOCALIZED_RESOURCES_FOLDER_PATH}"
    cp -R "$resource" "${TARGET_BUILD_DIR}/${UNLOCALIZED_RESOURCES_FOLDER_PATH}/"
  fi
done < "$resources_to_copy"

# ✅ Handle install if needed
if [[ "${ACTION}" == "install" ]] && [[ "${SKIP_INSTALL}" == "NO" ]]; then
  mkdir -p "${INSTALL_DIR}/${UNLOCALIZED_RESOURCES_FOLDER_PATH}"
  while IFS= read -r resource; do
    if [ -e "$resource" ]; then
      echo "Installing $resource to ${INSTALL_DIR}/${UNLOCALIZED_RESOURCES_FOLDER_PATH}"
      cp -R "$resource" "${INSTALL_DIR}/${UNLOCALIZED_RESOURCES_FOLDER_PATH}/"
    fi
  done < "$resources_to_copy"
fi

rm -f "$resources_to_copy"

# ✅ Asset catalog processing
if [[ -n "${WRAPPER_EXTENSION}" ]] && [ "`xcrun --find actool`" ] && [ -n "${XCASSET_FILES:-}" ]; then
  OTHER_XCASSETS=$(find -L "$PWD" -iname "*.xcassets" -type d)
  while read line; do
    if [[ $line != "${PODS_ROOT}*" ]]; then
      XCASSET_FILES+=("$line")
    fi
  done <<<"$OTHER_XCASSETS"

  if [ -z ${ASSETCATALOG_COMPILER_APPICON_NAME+x} ]; then
    printf "%s\0" "${XCASSET_FILES[@]}" | xargs -0 xcrun actool \
      --output-format human-readable-text --notices --warnings \
      --platform "${PLATFORM_NAME}" \
      --minimum-deployment-target "${!DEPLOYMENT_TARGET_SETTING_NAME}" \
      ${TARGET_DEVICE_ARGS} --compress-pngs \
      --compile "${BUILT_PRODUCTS_DIR}/${UNLOCALIZED_RESOURCES_FOLDER_PATH}"
  else
    printf "%s\0" "${XCASSET_FILES[@]}" | xargs -0 xcrun actool \
      --output-format human-readable-text --notices --warnings \
      --platform "${PLATFORM_NAME}" \
      --minimum-deployment-target "${!DEPLOYMENT_TARGET_SETTING_NAME}" \
      ${TARGET_DEVICE_ARGS} --compress-pngs \
      --compile "${BUILT_PRODUCTS_DIR}/${UNLOCALIZED_RESOURCES_FOLDER_PATH}" \
      --app-icon "${ASSETCATALOG_COMPILER_APPICON_NAME}" \
      --output-partial-info-plist "${TARGET_TEMP_DIR}/assetcatalog_generated_info_cocoapods.plist"
  fi
fi
