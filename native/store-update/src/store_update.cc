#include <node_api.h>
#include <windows.h>

#include <cstdint>
#include <cstdio>
#include <exception>
#include <string>

#include <winrt/Windows.ApplicationModel.h>
#include <winrt/Windows.Foundation.Collections.h>
#include <winrt/Windows.Services.Store.h>
#include <winrt/base.h>

namespace {

enum class OperationKind { Check, Install };

struct OperationData {
  napi_async_work work{};
  napi_deferred deferred{};
  OperationKind kind{OperationKind::Check};
  bool supported{false};
  bool available{false};
  bool mandatory{false};
  bool canInstallSilently{false};
  bool installed{false};
  uint32_t packageCount{0};
  std::string packageVersion;
  std::string packageFamilyName;
  std::string state{"unknown"};
  std::string reason;
  std::string errorCode;
};

void SetNamedBoolean(napi_env env, napi_value object, const char* name,
                     bool value) {
  napi_value output;
  napi_get_boolean(env, value, &output);
  napi_set_named_property(env, object, name, output);
}

void SetNamedUint32(napi_env env, napi_value object, const char* name,
                    uint32_t value) {
  napi_value output;
  napi_create_uint32(env, value, &output);
  napi_set_named_property(env, object, name, output);
}

void SetNamedString(napi_env env, napi_value object, const char* name,
                    const std::string& value) {
  napi_value output;
  napi_create_string_utf8(env, value.c_str(), value.size(), &output);
  napi_set_named_property(env, object, name, output);
}

std::string Narrow(winrt::hstring const& value) {
  return winrt::to_string(value);
}

std::string VersionString(
    winrt::Windows::ApplicationModel::PackageVersion const& version) {
  return std::to_string(version.Major) + "." +
         std::to_string(version.Minor) + "." +
         std::to_string(version.Build) + "." +
         std::to_string(version.Revision);
}

std::string StateName(
    winrt::Windows::Services::Store::StorePackageUpdateState state) {
  using winrt::Windows::Services::Store::StorePackageUpdateState;
  switch (state) {
    case StorePackageUpdateState::Pending:
      return "pending";
    case StorePackageUpdateState::Downloading:
      return "downloading";
    case StorePackageUpdateState::Deploying:
      return "deploying";
    case StorePackageUpdateState::Completed:
      return "completed";
    case StorePackageUpdateState::Canceled:
      return "canceled";
    case StorePackageUpdateState::ErrorLowBattery:
      return "low-battery";
    case StorePackageUpdateState::ErrorWiFiRecommended:
      return "wifi-recommended";
    case StorePackageUpdateState::ErrorWiFiRequired:
      return "wifi-required";
    case StorePackageUpdateState::OtherError:
    default:
      return "error";
  }
}

void ReadAvailableUpdates(OperationData* data) {
  using namespace winrt::Windows::Services::Store;

  auto context = StoreContext::GetDefault();
  auto updates = context.GetAppAndOptionalStorePackageUpdatesAsync().get();
  data->supported = true;
  data->packageCount = updates.Size();
  data->available = data->packageCount > 0;
  data->canInstallSilently =
      context.CanSilentlyDownloadStorePackageUpdates();

  for (auto const& update : updates) {
    data->mandatory = data->mandatory || update.Mandatory();
    if (data->packageVersion.empty()) {
      auto package = update.Package();
      data->packageVersion = VersionString(package.Id().Version());
      data->packageFamilyName = Narrow(package.Id().FamilyName());
    }
  }

  if (data->kind != OperationKind::Install || !data->available) {
    data->state = data->available ? "available" : "up-to-date";
    return;
  }

  if (!data->canInstallSilently) {
    data->state = "store-required";
    data->reason = "silent-install-unavailable";
    return;
  }

  auto result = context
                    .TrySilentDownloadAndInstallStorePackageUpdatesAsync(
                        updates)
                    .get();
  data->state = StateName(result.OverallState());
  data->installed =
      result.OverallState() == StorePackageUpdateState::Completed;
}

void ExecuteOperation(napi_env, void* rawData) {
  auto* data = static_cast<OperationData*>(rawData);
  bool apartmentInitialized = false;
  try {
    try {
      winrt::init_apartment(winrt::apartment_type::multi_threaded);
      apartmentInitialized = true;
    } catch (winrt::hresult_error const& error) {
      if (error.code() != RPC_E_CHANGED_MODE) throw;
    }

    auto currentPackage =
        winrt::Windows::ApplicationModel::Package::Current();
    data->packageFamilyName = Narrow(currentPackage.Id().FamilyName());
    ReadAvailableUpdates(data);
  } catch (winrt::hresult_error const& error) {
    data->state = "unavailable";
    data->reason = Narrow(error.message());
    char code[16]{};
    std::snprintf(code, sizeof(code), "0x%08X",
                  static_cast<uint32_t>(error.code().value));
    data->errorCode = code;
  } catch (std::exception const& error) {
    data->state = "unavailable";
    data->reason = error.what();
  } catch (...) {
    data->state = "unavailable";
    data->reason = "unknown-native-error";
  }

  if (apartmentInitialized) winrt::uninit_apartment();
}

void CompleteOperation(napi_env env, napi_status status, void* rawData) {
  auto* data = static_cast<OperationData*>(rawData);
  napi_value result;
  napi_create_object(env, &result);

  if (status != napi_ok) {
    data->state = "unavailable";
    data->reason = "native-worker-failed";
  }

  SetNamedBoolean(env, result, "supported", data->supported);
  SetNamedBoolean(env, result, "available", data->available);
  SetNamedBoolean(env, result, "mandatory", data->mandatory);
  SetNamedBoolean(env, result, "canInstallSilently",
                  data->canInstallSilently);
  SetNamedBoolean(env, result, "installed", data->installed);
  SetNamedUint32(env, result, "packageCount", data->packageCount);
  SetNamedString(env, result, "packageVersion", data->packageVersion);
  SetNamedString(env, result, "packageFamilyName",
                 data->packageFamilyName);
  SetNamedString(env, result, "state", data->state);
  SetNamedString(env, result, "reason", data->reason);
  SetNamedString(env, result, "errorCode", data->errorCode);

  napi_resolve_deferred(env, data->deferred, result);
  napi_delete_async_work(env, data->work);
  delete data;
}

napi_value StartOperation(napi_env env, OperationKind kind) {
  auto* data = new OperationData();
  data->kind = kind;

  napi_value promise;
  napi_create_promise(env, &data->deferred, &promise);

  napi_value resourceName;
  const char* name = kind == OperationKind::Check
                         ? "ShenPulseStoreUpdateCheck"
                         : "ShenPulseStoreUpdateInstall";
  napi_create_string_utf8(env, name, NAPI_AUTO_LENGTH, &resourceName);
  napi_create_async_work(env, nullptr, resourceName, ExecuteOperation,
                         CompleteOperation, data, &data->work);
  napi_queue_async_work(env, data->work);
  return promise;
}

napi_value CheckForUpdates(napi_env env, napi_callback_info) {
  return StartOperation(env, OperationKind::Check);
}

napi_value InstallUpdatesSilently(napi_env env, napi_callback_info) {
  return StartOperation(env, OperationKind::Install);
}

napi_value Initialize(napi_env env, napi_value exports) {
  napi_property_descriptor properties[] = {
      {"checkForUpdates", nullptr, CheckForUpdates, nullptr, nullptr,
       nullptr, napi_default, nullptr},
      {"installUpdatesSilently", nullptr, InstallUpdatesSilently, nullptr,
       nullptr, nullptr, napi_default, nullptr}};
  napi_define_properties(env, exports,
                         sizeof(properties) / sizeof(properties[0]),
                         properties);
  return exports;
}

}  // namespace

NAPI_MODULE(NODE_GYP_MODULE_NAME, Initialize)
