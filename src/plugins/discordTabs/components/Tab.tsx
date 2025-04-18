/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { classNameFactory } from "@api/Styles";
import { getIntlMessage } from "@utils/discord";
import { classes } from "@utils/misc";
import { DefaultExtractAndLoadChunksRegex, extractAndLoadChunksLazy, filters, findByCodeLazy, findByPropsLazy, findComponentByCodeLazy, findStoreLazy, mapMangledModuleLazy } from "@webpack";
import { Avatar, ChannelStore, ContextMenuApi, GenericStore, GuildStore, NavigationRouter, PresenceStore, ReadStateStore, SelectedChannelStore, SelectedGuildStore, Text, UserStore, useStateFromStores } from "@webpack/common";
import { Channel, Guild, User } from "discord-types/general";
import { waitForStore } from "webpack/common/internal";

import { BasicChannelTabsProps } from "../interfaces";
import { ChannelTab, useTabsStore } from "../stores/finalStore";
import ChannelIcon from "./Discord/ChannelIcon";
import GuildIcon from "./Discord/GuildIcon";
import TypingIndicator from "./Discord/TypingIndicator";
import useGroupableTab from "./useGroupableTab";
let TypingStore: GenericStore;
waitForStore("TypingStore", m => TypingStore = m);
export const useDrag = findByCodeLazy("useDrag::spec.begin");
export const useDrop = findByCodeLazy(/\i=\(0,\i.\i\)\(\i.options\)/); // findByCodeLazy(".options);return", ".collect,");

const dotStyles = findByPropsLazy("numberBadge", "textBadge");
const FriendsIcon = findComponentByCodeLazy("12h1a8");
const ChannelTypeIcon = findComponentByCodeLazy(".iconContainerWithGuildIcon,");

const cl = classNameFactory("vc-discordtabs-");

function XIcon({ size, fill }: { size: number, fill: string; }) {
    return <svg width={size} height={size} viewBox="0 0 24 24">
        <path fill={fill}
            d="M17.3 18.7a1 1 0 0 0 1.4-1.4L13.42 12l5.3-5.3a1 1 0 0 0-1.42-1.4L12 10.58l-5.3-5.3a1 1 0 0 0-1.4 1.42L10.58 12l-5.3 5.3a1 1 0 1 0 1.42 1.4L12 13.42l5.3 5.3Z"
        />
    </svg>;
}

export const NotificationDot = ({ channelIds }: { channelIds: string[]; }) => {
    const [unreadCount, mentionCount] = useStateFromStores(
        [ReadStateStore],
        () => [
            channelIds.reduce((count, channelId) => count + ReadStateStore.getUnreadCount(channelId), 0),
            channelIds.reduce((count, channelId) => count + ReadStateStore.getMentionCount(channelId), 0),
        ]
    );

    return unreadCount > 0 ? (
        <div
            data-has-mention={!!mentionCount}
            className={classes(dotStyles.numberBadge, dotStyles.baseShapeRound, cl("notification-badge"))}
        >
            {mentionCount || (unreadCount)}
        </div>
    ) : null;
};

function ChannelTabContent(props: BasicChannelTabsProps & {
    guild?: Guild,
    channel?: Channel;
}) {
    const { guild, guildId, channel, channelId } = props;
    const userId = UserStore.getCurrentUser()?.id;
    const recipients = channel?.recipients;
    const recipientId = recipients?.[0];
    const isTyping = useStateFromStores(
        [TypingStore],
        () => {
            const typingUsers = Object.keys(TypingStore.getTypingUsers(channelId)) as string[];
            return typingUsers.filter(id => id !== userId).length > 0;
        },
        [channelId, userId]
    );

    const status = useStateFromStores(
        [PresenceStore],
        () => PresenceStore.getStatus(recipientId) as string,
        [recipientId]
    );

    const isMobile = useStateFromStores(
        [PresenceStore],
        () => PresenceStore.isMobileOnline(recipientId) as boolean,
        [recipientId]
    );

    if (guild) {
        if (channel)
            return (
                <>
                    <GuildIcon guild={guild} />
                    <ChannelTypeIcon channel={channel} guild={guild} />
                    {<Text className={cl("name-text")}>{channel.name}</Text>}
                    <NotificationDot channelIds={[channel.id]} />
                    <TypingIndicator isTyping={isTyping} />
                </>
            );
        else {
            let name = `${getIntlMessage("UNKNOWN_CHANNEL")} (${channelId})`;
            switch (channelId) {
                case "customize-community":
                    name = getIntlMessage("CHANNELS_AND_ROLES");
                    break;
                case "channel-browser":
                    name = getIntlMessage("GUILD_SIDEBAR_CHANNEL_BROWSER");
                    break;
                case "shop":
                    name = getIntlMessage("GUILD_SHOP_CHANNEL_LABEL");
                    break;
                case "member-safety":
                    name = getIntlMessage("MEMBER_SAFETY_CHANNEL_TITLE");
                    break;
                case "@home":
                    name = getIntlMessage("SERVER_GUIDE");
                    break;
            }
            return (
                <>
                    <GuildIcon guild={guild} />
                    {<Text className={cl("name-text")}>{name}</Text>}
                </>
            );
        }
    }
    if (channel && recipients?.length) {
        if (recipients.length === 1) {
            const user = UserStore.getUser(recipients[0]) as User & { globalName: string, isPomelo(): boolean; };
            const username = user.globalName || user.username;

            return (
                <>
                    <Avatar
                        size="SIZE_24"
                        src={user.getAvatarURL(guildId, 128)}
                        status={status}
                        isTyping={isTyping}
                        isMobile={isMobile}
                    />
                    {<Text className={cl("name-text")} data-pomelo={user.isPomelo()}>
                        {username}
                    </Text>}
                    <NotificationDot channelIds={[channel.id]} />
                </>
            );
        } else {
            // Group DM
            return (
                <>
                    <ChannelIcon channel={channel} />
                    {<Text className={cl("name-text")}>{channel?.name || getIntlMessage("GROUP_DM")}</Text>}
                    <NotificationDot channelIds={[channel.id]} />
                    <TypingIndicator isTyping={isTyping} />
                </>
            );
        }
    }

    if (guildId === "@me")
        return (
            <>
                <FriendsIcon />
                {<Text className={cl("name-text")}>{getIntlMessage("FRIENDS")}</Text>}
            </>
        );

    return (
        <>

            {<Text className={cl("name-text")}>{getIntlMessage("UNKNOWN_CHANNEL")}</Text>}
        </>
    );
}

const { UserContext } = mapMangledModuleLazy('navId:"user-context"', {
    UserContext: filters.byCode("children:")
});

const { ChannelContext } = mapMangledModuleLazy('navId:"channel-context"', {
    ChannelContext: filters.byCode("children:")
});
const { GroupDMContext } = mapMangledModuleLazy('navId:"gdm-context"', {
    GroupDMContext: filters.byCode("children:")
});
const { ThreadContext } = mapMangledModuleLazy(',"Context Menu"', {
    ThreadContext: filters.byCode("children:")
});

// TODO: Fix this match.
const findUserContextChunks = extractAndLoadChunksLazy(["PrivateChannel.renderAvatar"], new RegExp(
    DefaultExtractAndLoadChunksRegex.source + ".{1,100}user:"
));
const findGroupContextChunks = extractAndLoadChunksLazy(["PrivateChannel.renderAvatar"]);
const findThreadContextChunks = extractAndLoadChunksLazy(["},handleRightClick:"]);
const findChannelContextChunks = extractAndLoadChunksLazy(["&&this.handleActivitiesPopoutClose(),"], new RegExp(DefaultExtractAndLoadChunksRegex.source + ".{1,150}isFavorite"));

const UserGuildSettingsStore = findStoreLazy("UserGuildSettingsStore");

interface TabProps {
    channelId: string;
    guildId: string;
    id: string;
    containerId: string;
    isTabGroup: boolean;
    isInTabGroup: boolean;
    isSelected: boolean;
    onClose: () => void;
    onDrop: (targetId: string, targetContainerId: string, placement: "before" | "after") => void;
}

export default function Tab({ channelId, guildId, id: tabId, isSelected, containerId, isTabGroup, isInTabGroup, onClose, onDrop }: TabProps) {
    const store = useTabsStore(state => ({
        getOrEnsureContainer: state.getOrEnsureContainer,
        moveTab: state.moveTab,
        addTab: state.addTab,
        isTabInContainer: state.isTabInContainer
    }));

    const getContainer = useTabsStore(state => state.getContainer);
    const getTab = useTabsStore(state => state.getTab);

    const { ref, isDragging, isHovering, dragPlacement } = useGroupableTab({
        tabId,
        containerId,
        isInTabGroup: isInTabGroup,
        isTabGroup: isTabGroup,
        onDrop: onDrop,
        store
    });

    const guild = GuildStore.getGuild(guildId);
    const channel = ChannelStore.getChannel(channelId);
    const isMuted = useStateFromStores(
        [UserGuildSettingsStore], () => UserGuildSettingsStore.isChannelMuted(guildId, channelId),
        [guildId, channelId], (old, current) => old === current
    );
    console.log("rerendering", channel);
    return (<div
        key={tabId}
        data-placement={isHovering && dragPlacement}
        className={cl("tab", { "tab-compact": false, "tab-selected": isSelected, "tab-muted": isMuted, "tab-dragging": isDragging })}
        ref={ref}
        onAuxClick={e => {
            if (e.button === 1 /* middle click */)
                onClose();
        }}
        onContextMenu={e => channel && ContextMenuApi.openContextMenuLazy(e, async () => {
            if (channel.isDM()) {
                const user = (UserStore.getUser(channel.recipients[0]) as User & { globalName: string, isPomelo(): boolean; });
                await findUserContextChunks();
                console.log("is user");
                return props => (
                    <UserContext
                        {...props}
                        user={user}
                        guildId={guild}
                        channel={channel}
                    />
                );
            } else if (channel.isGroupDM()) {
                console.log("is group");
                await findGroupContextChunks();
                return props => (<GroupDMContext {...props} channel={channel} />);
            } else if (channel.isThread()) {
                console.log("is thread");
                await findThreadContextChunks();
                return props => (<ThreadContext {...props} channel={channel} />);
            } else {
                console.log("is channel");
                await findChannelContextChunks();
                return props => (<ChannelContext {...props} channel={channel} guild={guild} />);
            }
        }
        )}
    >
        <button
            className={cl("button", "channel-info")}
            onClick={() => {
                if (!isTabGroup) {
                    if (channelId !== SelectedChannelStore.getChannelId() || guildId !== SelectedGuildStore.getGuildId())
                        NavigationRouter.transitionToGuild(guildId, channelId);
                } else {
                    const container = getContainer(tabId);
                    const firstTab = getTab<ChannelTab>(container.head!);
                    if (channelId !== SelectedChannelStore.getChannelId() || guildId !== SelectedGuildStore.getGuildId())
                        NavigationRouter.transitionToGuild(firstTab.guildId, firstTab.channelId);
                }
            }}
        >
            <div
                className={cl("tab-inner")}
                data-compact="false"
            >
                <ChannelTabContent guildId={guildId} channelId={channelId} guild={guild} channel={channel} />
            </div>
        </button>

        {<button
            className={cl("button", "close-button", { "close-button-compact": false, "hoverable": true })}
            onClick={onClose}
        >
            <XIcon size={16} fill="var(--interactive-normal)" />
        </button>}
    </div>);
}



// const ref = useRef<HTMLDivElement>(null);
//     const getTab = useTabsStore(state => state.getTab);
//     const getContainer = useTabsStore(state => state.getContainer);
//     const addTab = useTabsStore(state => state.addTab);
//     const moveTab = useTabsStore(state => state.moveTab);
//     const getOrEnsureContainer = useTabsStore(state => state.getOrEnsureContainer);
//     const isTabInContainer = useTabsStore(state => state.isTabInContainer);
//     const [{ isDragging }, drag] = useDrag(() => ({
//         type: "vc_DiscordTab",
//         item: { tabId, containerId, isInTabGroup, isTabGroup },
//         collect: monitor => ({ isDragging: monitor.isDragging() })
//     }), [tabId, containerId, isInTabGroup, isTabGroup]);

//     const [dragPlacement, setPlacement] = useState<"before" | "after" | "group">();
//     const [{ isHovering }, drop] = useDrop(() => ({
//         accept: "vc_DiscordTab",
//         collect: monitor => ({
//             isHovering: monitor.isOver(),
//         }),
//         canDrop: item => {
//             const areTabsDifferent = (item.tabId !== tabId);
//             const isTargetATabGroup = item.isTabGroup;
//             if (areTabsDifferent) {
//                 if (isTargetATabGroup && isTabInContainer(containerId, item.tabId)) {
//                     return true;
//                 } else if (!isTargetATabGroup) {
//                     return true;
//                 }
//             }
//             return false;
//         },
//         hover: lodash.throttle((item, monitor) => {
//             if (!ref.current) return;
//             if (!monitor.canDrop()) {
//                 if (dragPlacement) {
//                     setPlacement(undefined);
//                 }
//                 return;
//             }
//             const hoverBoundingRect = ref.current.getBoundingClientRect();
//             const hoverMiddleX = (hoverBoundingRect.right - hoverBoundingRect.left) / 2;
//             const clientOffset = monitor.getClientOffset();

//             if (!clientOffset) return;

//             const hoverClientX = clientOffset.x - hoverBoundingRect.left;

//             const groupZoneThreshold = 0.5;
//             const groupZoneStart = hoverBoundingRect.width * (0.5 - groupZoneThreshold / 2);
//             const groupZoneEnd = hoverBoundingRect.width * (0.5 + groupZoneThreshold / 2);
//             let placement: "before" | "after" | "group";


//             const isHoverInGroupZone = hoverClientX >= groupZoneStart && hoverClientX <= groupZoneEnd;
//             const isNotTabGroup = !item.isTabGroup;

//             const canGroup =
//                 // Case 1: Neither item nor dragged tab are in any group
//                 (!item.isInTabGroup && !isInTabGroup)
//                 ||
//                 // Case 2: Item is in a group, but dragged tab is not in that specific group
//                 (item.isInTabGroup && !isTabInContainer(item.containerId, tabId));

//             if (isHoverInGroupZone && isNotTabGroup && canGroup) {
//                 placement = "group";
//             } else if (hoverClientX < hoverMiddleX) {
//                 placement = "before";
//             } else {
//                 placement = "after";
//             }
//             if (dragPlacement === placement) return;
//             setPlacement(placement);
//         }, 300),
//         drop: item => {
//             if (!dragPlacement) return;
//             if (dragPlacement === "group") {
//                 if (isTabGroup) {
//                     const groupContainer = getOrEnsureContainer({
//                         id: tabId,
//                         name: `Test ${tabId}`,
//                         nodes: {},
//                         size: 0,
//                     });
//                     const targetSource = { containerId: groupContainer.id, tabId: undefined! };
//                     moveTab({ tabId: item.tabId, containerId: item.containerId }, targetSource, "after");
//                     console.log("MOVE DA TAB TO GROUP");
//                 } else {
//                     // todo: prob figure out a better way to make the id lol.
//                     const groupContainer = getOrEnsureContainer({
//                         id: `${tabId}${item.tabId}`,
//                         name: "Tab Group",
//                         nodes: {},
//                         size: 0,
//                     });
//                     addTab({
//                         id: groupContainer.id,
//                         container_id: containerId,
//                     }, {
//                         position: "after",
//                         targetTabId: tabId
//                     });
//                     const targetSource = { containerId: groupContainer.id, tabId: undefined! };
//                     moveTab({ tabId, containerId }, targetSource, "after");
//                     moveTab({ tabId: item.tabId, containerId: item.containerId }, targetSource, "after");
//                     console.log("MAKE DA GROUP GRRRRRRR");
//                 }
//             } else {
//                 onDrop(item.tabId, item.containerId, dragPlacement);
//             }
//         }
//     }), [tabId, onDrop, dragPlacement, containerId, isTabGroup, isInTabGroup]);
//     drag(drop(ref));
