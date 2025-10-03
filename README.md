# 🚍 NetoTrack – Dashboard de Monitoreo de Flota  

[![Next.js](https://img.shields.io/badge/Next.js-15-blue?logo=next.js)](https://nextjs.org/)
[![NestJS](https://img.shields.io/badge/NestJS-Framework-red?logo=nestjs)](https://nestjs.com/)
[![MySQL](https://img.shields.io/badge/MySQL-DB-blue?logo=mysql)](https://www.mysql.com/)
[![Docker](https://img.shields.io/badge/Docker-Ready-blue?logo=docker)](https://www.docker.com/)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

---

## 📌 Nombre del Proyecto  
**NetoTrack – Dashboard de Monitoreo de Flota**

---

## 🎯 Objetivo  
Desarrollar una aplicación web moderna y escalable que permita a las empresas de transporte **monitorear en tiempo real su flota de autobuses**, optimizando la gestión de combustible, ubicación y desempeño de los vehículos para **mejorar la eficiencia operativa y reducir costos**.  

---

## 📖 Resumen Ejecutivo  
**NetoTrack** es un **dashboard web** diseñado para empresas de transporte que buscan optimizar la gestión y control de su flota en tiempo real.  

La plataforma recopila datos de **GPS** y **sensores instalados en cada vehículo**, ofreciendo visualizaciones claras, modernas y fáciles de interpretar para decisiones estratégicas.  

---

## 📌 Alcance  
- 📍 **Ubicación en tiempo real** de cada autobús.  
- ⛽ **Nivel de diésel** en tanque y consumo histórico.  
- 🚌 **Selección de un bus específico** para métricas detalladas.  
- 📊 **Dashboard general** con estado de toda la flota.  
- 🕹️ **Visualizaciones 3D** de datos críticos.  
- 📱 **Interfaz responsiva** para administradores y operadores.  

---

## 🛠️ Tecnologías  

### 🔹 Frontend  
- [Next.js (React, TypeScript)](https://nextjs.org/)  
- [Three.js](https://threejs.org/) → Visualización 3D  
- [Leaflet](https://leafletjs.com/) / [Mapbox](https://www.mapbox.com/) → Mapas  

### 🔹 Backend *(fase posterior)*  
- [NestJS](https://nestjs.com/)  
- [MySQL](https://www.mysql.com/)  

### 🔹 DevOps  
- [Nginx](https://www.nginx.com/)  
- [Docker](https://www.docker.com/)  

### 🔹 Sensores y Dispositivos  
- 📡 **GPS** → Rastreo en tiempo real  
- ⚡ **BLE Capacitive Fuel Level Sensor** → Nivel de diésel  
- 🔄 **Sensores de flujo de combustible**  

---

## 🚀 Características Clave  
✔️ Datos en **tiempo real**  
✔️ **Visualizaciones 2D/3D**  
✔️ **Dashboard general + detalle por bus**  
✔️ **Escalable y modular**  
✔️ **Despliegue optimizado con Docker + Nginx**  

---

## 📂 Estructura del Proyecto  

```bash
NetoTrack/
├── frontend/       # Next.js (React + TypeScript)
├── backend/        # NestJS (fase 2)
├── database/       # Esquemas y migraciones MySQL
├── sensors/        # Integraciones GPS y sensores
├── docker/         # Archivos de despliegue con Docker
└── README.md       # Documentación
