<template>
  <v-app>
    <v-app-bar flat class="app-bar" height="68">
      <v-icon class="ms-4 me-2" color="secondary" size="26">mdi-cards-playing-outline</v-icon>
      <v-app-bar-title class="font-weight-bold">
        <span class="text-secondary">Dernier</span>
      </v-app-bar-title>

      <v-spacer />

      <v-btn
        v-for="item in navItems"
        :key="item.name"
        :to="{ name: item.name }"
        :prepend-icon="item.icon"
        variant="text"
        class="d-none d-md-flex me-2"
      >
        {{ item.label }}
      </v-btn>

      <v-btn
        class="d-md-none me-2"
        color="primary"
        variant="flat"
        icon="mdi-plus"
        :to="{ name: 'new-game' }"
      />
    </v-app-bar>

    <v-main>
      <router-view />
    </v-main>

    <v-bottom-navigation class="d-md-none" grow color="primary" bg-color="surface">
      <v-btn v-for="item in navItems" :key="item.name" :to="{ name: item.name }">
        <v-icon>{{ item.icon }}</v-icon>
        <span>{{ item.label }}</span>
      </v-btn>
    </v-bottom-navigation>
  </v-app>
</template>

<script setup lang="ts">
const navItems = [
  { name: 'home', label: 'Home', icon: 'mdi-home-variant-outline' },
  { name: 'players', label: 'Giocatori', icon: 'mdi-account-group-outline' },
  { name: 'new-game', label: 'Nuova partita', icon: 'mdi-plus-circle-outline' },
];
</script>
