# This file is the template the .github/workflows/update-homebrew-tap.yml
# workflow uses to regenerate the Cask published to mayurrawte/homebrew-teamsly
# on every release. The `version` and the two `sha256` values below may lag
# behind the latest release — use `brew tap mayurrawte/teamsly` for the live
# install path that auto-syncs.

cask "teamsly" do
  arch arm: "arm64", intel: "x64"

  version "0.1.0"

  on_arm do
    sha256 "4eb961c57ba4688bac465fe63b8583012476ae6274ee799a81ee6abf767c0314"
    url "https://github.com/mayurrawte/teamsly/releases/download/v#{version}/Teamsly-#{version}-arm64.dmg",
        verified: "github.com/mayurrawte/teamsly/"
  end
  on_intel do
    sha256 "8ebdf0bff74b2e72646e152651603fad73496e679fa4d75ad5f64ed2dea387da"
    url "https://github.com/mayurrawte/teamsly/releases/download/v#{version}/Teamsly-#{version}.dmg",
        verified: "github.com/mayurrawte/teamsly/"
  end

  name "Teamsly"
  desc "Open-source modern client for Microsoft Teams"
  homepage "https://github.com/mayurrawte/teamsly"

  livecheck do
    url :url
    strategy :github_latest
  end

  auto_updates true

  app "Teamsly.app"

  zap trash: [
    "~/Library/Application Support/Teamsly",
    "~/Library/Logs/Teamsly",
    "~/Library/Preferences/co.shipthis.teamsly.plist",
    "~/Library/Saved Application State/co.shipthis.teamsly.savedState",
  ]
end
