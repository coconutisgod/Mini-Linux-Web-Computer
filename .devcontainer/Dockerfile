FROM mcr.microsoft.com/devcontainers/base:debian-12

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ca-certificates \
        chromium \
        curl \
        dbus-x11 \
        file-roller \
        fonts-dejavu \
        fonts-liberation \
        galculator \
        git \
        htop \
        iproute2 \
        lsof \
        mousepad \
        nano \
        net-tools \
        novnc \
        openjdk-17-jre-headless \
        procps \
        ristretto \
        thunar \
        tigervnc-common \
        tigervnc-standalone-server \
        websockify \
        wget \
        x11-xserver-utils \
        xarchiver \
        xfce4 \
        xfce4-terminal \
        nodejs \
        npm \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*
