/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { DataStore } from "@api/index";
import { proxyLazy } from "@utils/lazy";
import { Flux, FluxDispatcher, UserStore } from "@webpack/common";

interface PersistentData {
    [userId: string]: {
        containers: Record<string, string>,
        tabs: Record<string, string>;
    };
}

const TabsStore = proxyLazy(() => {
    class TabsStore extends Flux.Store {
        public Tabs = {};
        public Containers = {};
        constructor(...args: ConstructorParameters<typeof Flux.Store>) {
            super(...args);
            this._getPersisted().then(data => {
                if (!data) {
                    console.log("No persistent data.");
                    return;
                }
                const { containers, tabs } = data[UserStore.getCurrentUser().id];
                this.Containers = containers;
                this.Tabs = tabs;
            });
        }
        emitChange(): void {
            // persist before emitting hm.....
            this._persist().then(() => super.emitChange());
        }
        private async _getPersisted() {
            return await DataStore.get<PersistentData>("vc-discordtabs");
        }
        private async _persist() {
            const currentUserId = UserStore.getCurrentUser().id;
            await DataStore.set("vc-discordtabs", {
                [currentUserId]: {
                    containers: this.Containers,
                    tabs: this.Tabs
                }
            } satisfies PersistentData);
        }
    }
    return new TabsStore(FluxDispatcher, {

    });
});
