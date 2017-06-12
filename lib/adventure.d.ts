declare namespace Adventure {
    function newAdventure(): any;
    function capitalize(str: any): any;
    function titleCase(str: any): any;
    function series(strs: any, conjunction?: any): any;
    class MutabilityMarker<T> {
        mutable: boolean;
        object: T;
        constructor(mutable: boolean, object: T);
    }
    type MaybeMarked<T> = T | MutabilityMarker<T>;
    type MaybePropertiesMarked<T> = {
        [P in keyof T]: MaybeMarked<T[P]>;
    };
    function mutable<T>(obj: MaybeMarked<T>, enforceIfWrapped?: boolean): MutabilityMarker<T>;
    function immutable<T>(obj: MaybeMarked<T>, enforceIfWrapped?: boolean): MutabilityMarker<T>;
    var openableExitOptions: {
        open: boolean;
        beOpenedBy: (subject: any) => void;
        beClosedBy: (subject: any) => void;
        beUsedBy: (subject: any) => void;
        beExaminedBy: (subject: any) => void;
        beUnlockedBy: (subject: any) => void;
        beLockedBy: (subject: any) => void;
        bePulledBy: (subject: any) => void;
        bePushedBy: (subject: any) => void;
    };
    var lockableExitOptions: {
        unlocked: boolean;
        beOpenedBy: (subject: any) => void;
        beUsedBy: (subject: any) => void;
        beExaminedBy: (subject: any) => void;
        beUnlockedBy: (subject: any) => void;
        beLockedBy: (subject: any) => void;
    };
}
