{
  "targets": [
    {
      "target_name": "shenpulse_store_update",
      "sources": ["src/store_update.cc"],
      "defines": [
        "NOMINMAX",
        "WIN32_LEAN_AND_MEAN",
        "_WIN32_WINNT=0x0A00"
      ],
      "libraries": ["windowsapp.lib"],
      "msvs_settings": {
        "VCCLCompilerTool": {
          "AdditionalIncludeDirectories": [
            "$(WindowsSdkDir)Include\\$(WindowsTargetPlatformVersion)\\cppwinrt"
          ],
          "AdditionalOptions": ["/std:c++20", "/EHsc", "/permissive-"],
          "ExceptionHandling": 1
        }
      }
    }
  ]
}
