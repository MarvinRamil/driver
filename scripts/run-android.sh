#!/usr/bin/env bash
set -euo pipefail

if [ -z "${JAVA_HOME:-}" ]; then
  for candidate in \
    /usr/lib/jvm/java-21-temurin-jdk \
    /usr/lib/jvm/temurin-21-jdk \
    /usr/lib/jvm/java-21-openjdk \
    /usr/lib/jvm/java-17-openjdk; do
    if [ -x "$candidate/bin/java" ]; then
      export JAVA_HOME="$candidate"
      break
    fi
  done
fi

if [ -z "${JAVA_HOME:-}" ]; then
  echo "error: Gradle requires JDK 17 or 21. Java 25 is not supported yet." >&2
  echo "Install JDK 21 or set JAVA_HOME to a compatible JDK, then retry." >&2
  exit 1
fi

exec npx expo run:android "$@"
