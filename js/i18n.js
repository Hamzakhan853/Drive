/**
 * Mini Drive i18n
 */
(function () {
  "use strict";

  const STRINGS = {
    en: {
      // sidebar
      home: "Home",
      myDrive: "My Drive",
      shared: "Shared",
      starred: "Starred",
      recent: "Recent",
      trash: "Trash",
      settings: "Settings",
      storage: "Storage",
      storageUsed: "{used} of 1 GB used",
      new: "New",
      newFolder: "New folder",
      uploadFolder: "Upload folder",
      uploadFiles: "Upload files",
      // dashboard titles
      titleHome: "Home",
      titleMyDrive: "My Drive",
      titleShared: "Shared with me",
      titleStarred: "Starred",
      titleRecent: "Recent",
      titleTrash: "Trash",
      titleSettings: "Settings",
      folders: "Folders",
      files: "Files",
      recentFiles: "Recent files",
      foldersInTrash: "Folders in trash",
      filesInTrash: "Files in trash",
      emptyTitle: "Your drive is empty",
      nothingStarred: "Nothing starred",
      nothingStarredHint: "Star files or folders in My Drive to see them here.",
      nothingShared: "Nothing shared",
      nothingSharedHint: "Mark items as shared in My Drive to see them here.",
      emptyDesc: "Create a folder or upload files to get started.",
      folderEmptyTitle: "This folder is empty",
      folderEmptyDesc: "Add files or create folders here.",
      emptyFolder: "Empty folder",
      inTrash: "In trash",
      items: "{n} item",
      items_plural: "{n} items",
      // trash
      trashHint: "Deleted items stay here until you recover or delete them permanently.",
      trashEmptyHint: "Trash is empty.",
      select: "Select",
      recoverAll: "Recover all",
      emptyTrash: "Empty trash",
      cancel: "Cancel",
      selected: "{n} selected",
      recover: "Recover",
      deletePermanently: "Delete permanently",
      // search / nav
      searchPlaceholder: "Search in Drive",
      help: "Help",
      notifications: "Notifications",
      // settings
      settingsIntro: "Manage your Mini Drive preferences. Changes save automatically.",
      account: "Account",
      appearance: "Appearance",
      filePrefs: "File & Folder Preferences",
      notificationsSection: "Notifications",
      trashSection: "Trash",
      storageSection: "Storage",
      languageSection: "Language",
      accessibility: "Accessibility",
      keyboardShortcuts: "Keyboard Shortcuts",
      signOut: "Sign out",
      signOutHint: "Return to the login page",
      switchAccount: "Switch account",
      logOut: "Log out",
      switch: "Switch",
      theme: "Theme",
      light: "Light",
      dark: "Dark",
      system: "System",
      systemHint: "System follows your device setting",
      viewLayout: "View layout",
      grid: "Grid",
      list: "List",
      defaultSort: "Default sort",
      sortName: "Name",
      sortDate: "Date modified",
      sortSize: "Size",
      sortType: "Type",
      sortDirection: "Sort direction",
      ascending: "Ascending",
      descending: "Descending",
      showExtensions: "Show file extensions",
      showExtensionsHint: "e.g. Report.pdf vs Report",
      confirmBeforeDelete: "Confirm before delete",
      confirmBeforeDeleteHint: "Ask before moving items to Trash",
      inAppNotifications: "In-app notifications",
      inAppNotificationsHint: "Toasts for uploads, deletes, and recoveries",
      autoDelete: "Auto-delete files in Trash",
      never: "Never",
      after7: "After 7 days",
      after30: "After 30 days",
      after90: "After 90 days",
      autoDeleteHint: "Permanently remove old trash items automatically",
      confirmPermanentDelete: "Confirm permanent delete",
      confirmPermanentDeleteHint: "Extra warning before permanent deletion",
      emptyTrashNow: "Empty Trash now",
      emptyTrashBtn: "Empty Trash",
      ofUsed: "of 1 GB used · {n} files",
      images: "Images",
      videos: "Videos",
      audio: "Audio",
      documents: "Documents",
      other: "Other",
      inTrashLabel: "In Trash",
      appLanguage: "App language",
      languageHint: "Changes labels across the app",
      reducedMotion: "Reduced motion",
      reducedMotionHint: "Minimize animations",
      largerText: "Larger text",
      largerTextHint: "Increase dashboard text size",
      settingsSaved: "Settings saved",
      preferenceUpdated: "Preference updated.",
      // confirms
      moveToTrashTitle: "Move to Trash?",
      moveToTrashMsg: "“{name}” will be moved to Trash. You can recover it later or delete it permanently from Trash.",
      moveToTrashBtn: "Move to Trash",
      deletePermTitle: "Delete permanently?",
      deletePermMsg: "“{name}” will be removed forever. This cannot be undone and the item cannot be recovered.",
      deleteForever: "Delete forever",
      recoverAllTitle: "Recover all items?",
      recoverAllMsg: "Restore all {n} item(s) from Trash back to their original places when possible.",
      recoverAllBtn: "Recover all",
      emptyTrashTitle: "Empty Trash?",
      emptyTrashMsg: "This will permanently delete all {n} item(s). This cannot be undone.",
      deleteSelectedMsg: "{n} selected item(s) will be removed forever. This cannot be undone.",
      // toasts
      movedToTrash: "Moved to Trash",
      movedToTrashMsg: "“{name}” is in Trash. Open Trash to recover it or delete it permanently.",
      deletedPermanently: "Deleted permanently",
      removedForever: "“{name}” has been removed forever.",
      recovered: "Recovered",
      recoveredMsg: "“{name}” is back in {place}.",
      itsFolder: "its folder",
      myDrivePlace: "My Drive",
      recoveredCount: "{n} item(s) restored.",
      trashEmptied: "Trash emptied",
      allDeleted: "All items were permanently deleted.",
      removedCount: "{n} item(s) removed forever.",
      trashIsEmpty: "Trash is empty",
      nothingToDelete: "Nothing to delete.",
      folderCreated: "Folder created",
      folderAdded: "“{name}” was added.",
      renamed: "Renamed",
      nowNamed: "Now named “{name}”.",
      starred: "Starred",
      removedStar: "Removed star",
      markedShared: "Marked as shared",
      removedShared: "Removed from Shared",
      filesUploaded: "Files uploaded",
      filesNowInDrive: "{n} file(s) are now in your Drive.",
      ok: "OK",
      createFolderTitle: "Create a new folder",
      createFolderDesc: "Give your folder a clear and memorable name.",
      folderName: "Folder name",
      createFolderBtn: "Create folder",
      uploadTitle: "Upload to Mini Drive",
      back: "Back",
    },
    hi: {
      home: "होम",
      myDrive: "मेरा ड्राइव",
      shared: "साझा",
      starred: "तारांकित",
      recent: "हालिया",
      trash: "ट्रैश",
      settings: "सेटिंग्स",
      storage: "स्टोरेज",
      storageUsed: "1 GB में से {used} उपयोग",
      new: "नया",
      newFolder: "नया फ़ोल्डर",
      uploadFolder: "फ़ोल्डर अपलोड",
      uploadFiles: "फ़ाइलें अपलोड",
      titleHome: "होम",
      titleMyDrive: "मेरा ड्राइव",
      titleShared: "मेरे साथ साझा",
      titleStarred: "तारांकित",
      titleRecent: "हालिया",
      titleTrash: "ट्रैश",
      titleSettings: "सेटिंग्स",
      folders: "फ़ोल्डर",
      files: "फ़ाइलें",
      recentFiles: "हालिया फ़ाइलें",
      foldersInTrash: "ट्रैश में फ़ोल्डर",
      filesInTrash: "ट्रैश में फ़ाइलें",
      emptyTitle: "आपका ड्राइव खाली है",
      nothingStarred: "कुछ भी तारांकित नहीं",
      nothingStarredHint: "यहाँ देखने के लिए मेरा ड्राइव में फ़ाइलें या फ़ोल्डर तारांकित करें।",
      nothingShared: "कुछ भी साझा नहीं",
      nothingSharedHint: "यहाँ देखने के लिए मेरा ड्राइव में आइटम साझा चिह्नित करें।",
      emptyDesc: "शुरू करने के लिए फ़ोल्डर बनाएँ या फ़ाइलें अपलोड करें।",
      folderEmptyTitle: "यह फ़ोल्डर खाली है",
      folderEmptyDesc: "यहाँ फ़ाइलें जोड़ें या फ़ोल्डर बनाएँ।",
      emptyFolder: "खाली फ़ोल्डर",
      inTrash: "ट्रैश में",
      items: "{n} आइटम",
      items_plural: "{n} आइटम",
      trashHint: "हटाई गई चीज़ें यहाँ रहती हैं जब तक आप पुनर्प्राप्त या स्थायी रूप से हटाते नहीं।",
      trashEmptyHint: "ट्रैश खाली है।",
      select: "चुनें",
      recoverAll: "सभी पुनर्प्राप्त करें",
      emptyTrash: "ट्रैश खाली करें",
      cancel: "रद्द करें",
      selected: "{n} चयनित",
      recover: "पुनर्प्राप्त करें",
      deletePermanently: "स्थायी रूप से हटाएँ",
      searchPlaceholder: "ड्राइव में खोजें",
      help: "मदद",
      notifications: "सूचनाएँ",
      settingsIntro: "अपनी मिनी ड्राइव प्राथमिकताएँ प्रबंधित करें। परिवर्तन स्वतः सहेजे जाते हैं।",
      account: "खाता",
      appearance: "दिखावट",
      filePrefs: "फ़ाइल और फ़ोल्डर प्राथमिकताएँ",
      notificationsSection: "सूचनाएँ",
      trashSection: "ट्रैश",
      storageSection: "स्टोरेज",
      languageSection: "भाषा",
      accessibility: "पहुँच योग्यता",
      keyboardShortcuts: "कीबोर्ड शॉर्टकट",
      signOut: "साइन आउट",
      signOutHint: "लॉगिन पृष्ठ पर वापस जाएँ",
      switchAccount: "खाता बदलें",
      logOut: "लॉग आउट",
      switch: "बदलें",
      theme: "थीम",
      light: "लाइट",
      dark: "डार्क",
      system: "सिस्टम",
      systemHint: "सिस्टम आपके डिवाइस की सेटिंग का पालन करता है",
      viewLayout: "लेआउट देखें",
      grid: "ग्रिड",
      list: "सूची",
      defaultSort: "डिफ़ॉल्ट क्रम",
      sortName: "नाम",
      sortDate: "संशोधित तिथि",
      sortSize: "आकार",
      sortType: "प्रकार",
      sortDirection: "क्रम दिशा",
      ascending: "आरोही",
      descending: "अवरोही",
      showExtensions: "फ़ाइल एक्सटेंशन दिखाएँ",
      showExtensionsHint: "जैसे Report.pdf बनाम Report",
      confirmBeforeDelete: "हटाने से पहले पुष्टि",
      confirmBeforeDeleteHint: "ट्रैश में भेजने से पहले पूछें",
      inAppNotifications: "ऐप सूचनाएँ",
      inAppNotificationsHint: "अपलोड, हटाने और पुनर्प्राप्ति के लिए संदेश",
      autoDelete: "ट्रैश में स्वतः हटाएँ",
      never: "कभी नहीं",
      after7: "7 दिन बाद",
      after30: "30 दिन बाद",
      after90: "90 दिन बाद",
      autoDeleteHint: "पुरानी ट्रैश चीज़ें स्वतः स्थायी रूप से हटाएँ",
      confirmPermanentDelete: "स्थायी हटाने की पुष्टि",
      confirmPermanentDeleteHint: "स्थायी हटाने से पहले अतिरिक्त चेतावनी",
      emptyTrashNow: "अभी ट्रैश खाली करें",
      emptyTrashBtn: "ट्रैश खाली करें",
      ofUsed: "1 GB में से · {n} फ़ाइलें",
      images: "छवियाँ",
      videos: "वीडियो",
      audio: "ऑडियो",
      documents: "दस्तावेज़",
      other: "अन्य",
      inTrashLabel: "ट्रैश में",
      appLanguage: "ऐप भाषा",
      languageHint: "पूरे ऐप के लेबल बदलता है",
      reducedMotion: "कम एनीमेशन",
      reducedMotionHint: "एनीमेशन कम करें",
      largerText: "बड़ा टेक्स्ट",
      largerTextHint: "डैशबोर्ड टेक्स्ट बड़ा करें",
      settingsSaved: "सेटिंग्स सहेजी गईं",
      preferenceUpdated: "प्राथमिकता अपडेट हुई।",
      moveToTrashTitle: "ट्रैश में भेजें?",
      moveToTrashMsg: "“{name}” ट्रैश में जाएगा। बाद में पुनर्प्राप्त या स्थायी रूप से हटा सकते हैं।",
      moveToTrashBtn: "ट्रैश में भेजें",
      deletePermTitle: "स्थायी रूप से हटाएँ?",
      deletePermMsg: "“{name}” हमेशा के लिए हट जाएगा। इसे वापस नहीं लाया जा सकता।",
      deleteForever: "हमेशा के लिए हटाएँ",
      recoverAllTitle: "सभी पुनर्प्राप्त करें?",
      recoverAllMsg: "ट्रैश से सभी {n} आइटम पुनर्स्थापित करें।",
      recoverAllBtn: "सभी पुनर्प्राप्त करें",
      emptyTrashTitle: "ट्रैश खाली करें?",
      emptyTrashMsg: "सभी {n} आइटम स्थायी रूप से हट जाएँगे। यह पूर्ववत नहीं होगा।",
      deleteSelectedMsg: "{n} चयनित आइटम हमेशा के लिए हटेंगे।",
      movedToTrash: "ट्रैश में भेजा गया",
      movedToTrashMsg: "“{name}” ट्रैश में है।",
      deletedPermanently: "स्थायी रूप से हटाया गया",
      removedForever: "“{name}” हमेशा के लिए हट गया।",
      recovered: "पुनर्प्राप्त",
      recoveredMsg: "“{name}” वापस {place} में है।",
      itsFolder: "अपने फ़ोल्डर",
      myDrivePlace: "मेरा ड्राइव",
      recoveredCount: "{n} आइटम पुनर्स्थापित।",
      trashEmptied: "ट्रैश खाली",
      allDeleted: "सभी आइटम स्थायी रूप से हटाए गए।",
      removedCount: "{n} आइटम हमेशा के लिए हटाए गए।",
      trashIsEmpty: "ट्रैश खाली है",
      nothingToDelete: "हटाने के लिए कुछ नहीं।",
      folderCreated: "फ़ोल्डर बना",
      folderAdded: "“{name}” जोड़ा गया।",
      renamed: "नाम बदला",
      nowNamed: "अब नाम “{name}” है।",
      starred: "तारांकित",
      removedStar: "तार हटाया",
      markedShared: "साझा चिह्नित",
      removedShared: "साझा से हटाया",
      filesUploaded: "फ़ाइलें अपलोड",
      filesNowInDrive: "{n} फ़ाइल(ें) अब ड्राइव में हैं।",
      ok: "ठीक",
      createFolderTitle: "नया फ़ोल्डर बनाएँ",
      createFolderDesc: "फ़ोल्डर को स्पष्ट नाम दें।",
      folderName: "फ़ोल्डर का नाम",
      createFolderBtn: "फ़ोल्डर बनाएँ",
      uploadTitle: "मिनी ड्राइव में अपलोड",
      back: "वापस",
    },
    es: {
      home: "Inicio",
      myDrive: "Mi unidad",
      shared: "Compartido",
      starred: "Destacados",
      recent: "Recientes",
      trash: "Papelera",
      settings: "Ajustes",
      storage: "Almacenamiento",
      storageUsed: "{used} de 1 GB usados",
      new: "Nuevo",
      newFolder: "Nueva carpeta",
      uploadFolder: "Subir carpeta",
      uploadFiles: "Subir archivos",
      titleHome: "Inicio",
      titleMyDrive: "Mi unidad",
      titleShared: "Compartido conmigo",
      titleStarred: "Destacados",
      titleRecent: "Recientes",
      titleTrash: "Papelera",
      titleSettings: "Ajustes",
      folders: "Carpetas",
      files: "Archivos",
      recentFiles: "Archivos recientes",
      foldersInTrash: "Carpetas en la papelera",
      filesInTrash: "Archivos en la papelera",
      emptyTitle: "Tu unidad está vacía",
      nothingStarred: "Nada destacado",
      nothingStarredHint: "Marca con estrella archivos o carpetas en Mi unidad para verlos aquí.",
      nothingShared: "Nada compartido",
      nothingSharedHint: "Marca elementos como compartidos en Mi unidad para verlos aquí.",
      emptyDesc: "Crea una carpeta o sube archivos para empezar.",
      folderEmptyTitle: "Esta carpeta está vacía",
      folderEmptyDesc: "Añade archivos o crea carpetas aquí.",
      emptyFolder: "Carpeta vacía",
      inTrash: "En la papelera",
      items: "{n} elemento",
      items_plural: "{n} elementos",
      trashHint: "Los elementos eliminados permanecen aquí hasta que los recuperes o elimines permanentemente.",
      trashEmptyHint: "La papelera está vacía.",
      select: "Seleccionar",
      recoverAll: "Recuperar todo",
      emptyTrash: "Vaciar papelera",
      cancel: "Cancelar",
      selected: "{n} seleccionados",
      recover: "Recuperar",
      deletePermanently: "Eliminar permanentemente",
      searchPlaceholder: "Buscar en Drive",
      help: "Ayuda",
      notifications: "Notificaciones",
      settingsIntro: "Administra tus preferencias de Mini Drive. Los cambios se guardan automáticamente.",
      account: "Cuenta",
      appearance: "Apariencia",
      filePrefs: "Preferencias de archivos y carpetas",
      notificationsSection: "Notificaciones",
      trashSection: "Papelera",
      storageSection: "Almacenamiento",
      languageSection: "Idioma",
      accessibility: "Accesibilidad",
      keyboardShortcuts: "Atajos de teclado",
      signOut: "Cerrar sesión",
      signOutHint: "Volver a la página de inicio de sesión",
      switchAccount: "Cambiar cuenta",
      logOut: "Salir",
      switch: "Cambiar",
      theme: "Tema",
      light: "Claro",
      dark: "Oscuro",
      system: "Sistema",
      systemHint: "El sistema sigue la configuración del dispositivo",
      viewLayout: "Vista",
      grid: "Cuadrícula",
      list: "Lista",
      defaultSort: "Orden predeterminado",
      sortName: "Nombre",
      sortDate: "Fecha de modificación",
      sortSize: "Tamaño",
      sortType: "Tipo",
      sortDirection: "Dirección",
      ascending: "Ascendente",
      descending: "Descendente",
      showExtensions: "Mostrar extensiones",
      showExtensionsHint: "p. ej. Informe.pdf vs Informe",
      confirmBeforeDelete: "Confirmar antes de eliminar",
      confirmBeforeDeleteHint: "Preguntar antes de enviar a la papelera",
      inAppNotifications: "Notificaciones en la app",
      inAppNotificationsHint: "Avisos de subidas, eliminaciones y recuperaciones",
      autoDelete: "Eliminar automáticamente de la papelera",
      never: "Nunca",
      after7: "Después de 7 días",
      after30: "Después de 30 días",
      after90: "Después de 90 días",
      autoDeleteHint: "Eliminar permanentemente elementos antiguos",
      confirmPermanentDelete: "Confirmar eliminación permanente",
      confirmPermanentDeleteHint: "Aviso extra antes de borrar para siempre",
      emptyTrashNow: "Vaciar papelera ahora",
      emptyTrashBtn: "Vaciar papelera",
      ofUsed: "de 15 GB · {n} archivos",
      images: "Imágenes",
      videos: "Vídeos",
      audio: "Audio",
      documents: "Documentos",
      other: "Otros",
      inTrashLabel: "En la papelera",
      appLanguage: "Idioma de la app",
      languageHint: "Cambia las etiquetas de toda la app",
      reducedMotion: "Menos animación",
      reducedMotionHint: "Minimizar animaciones",
      largerText: "Texto más grande",
      largerTextHint: "Aumentar el tamaño del texto",
      settingsSaved: "Ajustes guardados",
      preferenceUpdated: "Preferencia actualizada.",
      moveToTrashTitle: "¿Mover a la papelera?",
      moveToTrashMsg: "“{name}” se moverá a la papelera. Podrás recuperarlo o eliminarlo permanentemente después.",
      moveToTrashBtn: "Mover a la papelera",
      deletePermTitle: "¿Eliminar permanentemente?",
      deletePermMsg: "“{name}” se eliminará para siempre. No se puede deshacer.",
      deleteForever: "Eliminar para siempre",
      recoverAllTitle: "¿Recuperar todo?",
      recoverAllMsg: "Restaurar los {n} elemento(s) de la papelera.",
      recoverAllBtn: "Recuperar todo",
      emptyTrashTitle: "¿Vaciar papelera?",
      emptyTrashMsg: "Se eliminarán permanentemente {n} elemento(s). No se puede deshacer.",
      deleteSelectedMsg: "{n} elemento(s) seleccionados se eliminarán para siempre.",
      movedToTrash: "Movido a la papelera",
      movedToTrashMsg: "“{name}” está en la papelera.",
      deletedPermanently: "Eliminado permanentemente",
      removedForever: "“{name}” se eliminó para siempre.",
      recovered: "Recuperado",
      recoveredMsg: "“{name}” volvió a {place}.",
      itsFolder: "su carpeta",
      myDrivePlace: "Mi unidad",
      recoveredCount: "{n} elemento(s) restaurados.",
      trashEmptied: "Papelera vaciada",
      allDeleted: "Todos los elementos se eliminaron permanentemente.",
      removedCount: "{n} elemento(s) eliminados para siempre.",
      trashIsEmpty: "La papelera está vacía",
      nothingToDelete: "No hay nada que eliminar.",
      folderCreated: "Carpeta creada",
      folderAdded: "Se añadió “{name}”.",
      renamed: "Renombrado",
      nowNamed: "Ahora se llama “{name}”.",
      starred: "Destacado",
      removedStar: "Destacado quitado",
      markedShared: "Marcado como compartido",
      removedShared: "Quitado de Compartido",
      filesUploaded: "Archivos subidos",
      filesNowInDrive: "{n} archivo(s) están en tu unidad.",
      ok: "Aceptar",
      createFolderTitle: "Crear una carpeta nueva",
      createFolderDesc: "Ponle un nombre claro a tu carpeta.",
      folderName: "Nombre de la carpeta",
      createFolderBtn: "Crear carpeta",
      uploadTitle: "Subir a Mini Drive",
      back: "Atrás",
    },
    fr: {
      home: "Accueil",
      myDrive: "Mon Drive",
      shared: "Partagé",
      starred: "Favoris",
      recent: "Récents",
      trash: "Corbeille",
      settings: "Paramètres",
      storage: "Stockage",
      storageUsed: "{used} sur 1 Go utilisés",
      new: "Nouveau",
      newFolder: "Nouveau dossier",
      uploadFolder: "Importer un dossier",
      uploadFiles: "Importer des fichiers",
      titleHome: "Accueil",
      titleMyDrive: "Mon Drive",
      titleShared: "Partagé avec moi",
      titleStarred: "Favoris",
      titleRecent: "Récents",
      titleTrash: "Corbeille",
      titleSettings: "Paramètres",
      folders: "Dossiers",
      files: "Fichiers",
      recentFiles: "Fichiers récents",
      foldersInTrash: "Dossiers dans la corbeille",
      filesInTrash: "Fichiers dans la corbeille",
      emptyTitle: "Votre Drive est vide",
      nothingStarred: "Rien en favoris",
      nothingStarredHint: "Ajoutez des fichiers ou dossiers en favoris dans Mon Drive pour les voir ici.",
      nothingShared: "Rien de partagé",
      nothingSharedHint: "Marquez des éléments comme partagés dans Mon Drive pour les voir ici.",
      emptyDesc: "Créez un dossier ou importez des fichiers pour commencer.",
      folderEmptyTitle: "Ce dossier est vide",
      folderEmptyDesc: "Ajoutez des fichiers ou créez des dossiers ici.",
      emptyFolder: "Dossier vide",
      inTrash: "Dans la corbeille",
      items: "{n} élément",
      items_plural: "{n} éléments",
      trashHint: "Les éléments supprimés restent ici jusqu'à récupération ou suppression définitive.",
      trashEmptyHint: "La corbeille est vide.",
      select: "Sélectionner",
      recoverAll: "Tout récupérer",
      emptyTrash: "Vider la corbeille",
      cancel: "Annuler",
      selected: "{n} sélectionné(s)",
      recover: "Récupérer",
      deletePermanently: "Supprimer définitivement",
      searchPlaceholder: "Rechercher dans Drive",
      help: "Aide",
      notifications: "Notifications",
      settingsIntro: "Gérez vos préférences Mini Drive. Les modifications sont enregistrées automatiquement.",
      account: "Compte",
      appearance: "Apparence",
      filePrefs: "Préférences fichiers et dossiers",
      notificationsSection: "Notifications",
      trashSection: "Corbeille",
      storageSection: "Stockage",
      languageSection: "Langue",
      accessibility: "Accessibilité",
      keyboardShortcuts: "Raccourcis clavier",
      signOut: "Se déconnecter",
      signOutHint: "Retourner à la page de connexion",
      switchAccount: "Changer de compte",
      logOut: "Déconnexion",
      switch: "Changer",
      theme: "Thème",
      light: "Clair",
      dark: "Sombre",
      system: "Système",
      systemHint: "Suit les réglages de votre appareil",
      viewLayout: "Disposition",
      grid: "Grille",
      list: "Liste",
      defaultSort: "Tri par défaut",
      sortName: "Nom",
      sortDate: "Date de modification",
      sortSize: "Taille",
      sortType: "Type",
      sortDirection: "Sens du tri",
      ascending: "Croissant",
      descending: "Décroissant",
      showExtensions: "Afficher les extensions",
      showExtensionsHint: "ex. Rapport.pdf vs Rapport",
      confirmBeforeDelete: "Confirmer avant suppression",
      confirmBeforeDeleteHint: "Demander avant d'envoyer à la corbeille",
      inAppNotifications: "Notifications dans l'app",
      inAppNotificationsHint: "Toasts pour imports, suppressions et récupérations",
      autoDelete: "Suppression auto dans la corbeille",
      never: "Jamais",
      after7: "Après 7 jours",
      after30: "Après 30 jours",
      after90: "Après 90 jours",
      autoDeleteHint: "Supprimer définitivement les anciens éléments",
      confirmPermanentDelete: "Confirmer la suppression définitive",
      confirmPermanentDeleteHint: "Avertissement supplémentaire",
      emptyTrashNow: "Vider la corbeille maintenant",
      emptyTrashBtn: "Vider la corbeille",
      ofUsed: "sur 15 Go · {n} fichiers",
      images: "Images",
      videos: "Vidéos",
      audio: "Audio",
      documents: "Documents",
      other: "Autres",
      inTrashLabel: "Dans la corbeille",
      appLanguage: "Langue de l'application",
      languageHint: "Modifie les libellés de toute l'application",
      reducedMotion: "Réduire les animations",
      reducedMotionHint: "Minimiser les animations",
      largerText: "Texte plus grand",
      largerTextHint: "Augmenter la taille du texte",
      settingsSaved: "Paramètres enregistrés",
      preferenceUpdated: "Préférence mise à jour.",
      moveToTrashTitle: "Déplacer vers la corbeille ?",
      moveToTrashMsg: "« {name} » sera déplacé vers la corbeille. Vous pourrez le récupérer ou le supprimer définitivement plus tard.",
      moveToTrashBtn: "Mettre à la corbeille",
      deletePermTitle: "Supprimer définitivement ?",
      deletePermMsg: "« {name} » sera supprimé pour toujours. Action irréversible.",
      deleteForever: "Supprimer définitivement",
      recoverAllTitle: "Tout récupérer ?",
      recoverAllMsg: "Restaurer les {n} élément(s) de la corbeille.",
      recoverAllBtn: "Tout récupérer",
      emptyTrashTitle: "Vider la corbeille ?",
      emptyTrashMsg: "Supprimera définitivement {n} élément(s). Irréversible.",
      deleteSelectedMsg: "{n} élément(s) sélectionné(s) seront supprimés pour toujours.",
      movedToTrash: "Déplacé vers la corbeille",
      movedToTrashMsg: "« {name} » est dans la corbeille.",
      deletedPermanently: "Supprimé définitivement",
      removedForever: "« {name} » a été supprimé pour toujours.",
      recovered: "Récupéré",
      recoveredMsg: "« {name} » est de retour dans {place}.",
      itsFolder: "son dossier",
      myDrivePlace: "Mon Drive",
      recoveredCount: "{n} élément(s) restauré(s).",
      trashEmptied: "Corbeille vidée",
      allDeleted: "Tous les éléments ont été supprimés définitivement.",
      removedCount: "{n} élément(s) supprimés pour toujours.",
      trashIsEmpty: "La corbeille est vide",
      nothingToDelete: "Rien à supprimer.",
      folderCreated: "Dossier créé",
      folderAdded: "« {name} » a été ajouté.",
      renamed: "Renommé",
      nowNamed: "Maintenant nommé « {name} ».",
      starred: "Ajouté aux favoris",
      removedStar: "Retiré des favoris",
      markedShared: "Marqué comme partagé",
      removedShared: "Retiré de Partagé",
      filesUploaded: "Fichiers importés",
      filesNowInDrive: "{n} fichier(s) sont dans votre Drive.",
      ok: "OK",
      createFolderTitle: "Créer un nouveau dossier",
      createFolderDesc: "Donnez un nom clair à votre dossier.",
      folderName: "Nom du dossier",
      createFolderBtn: "Créer le dossier",
      uploadTitle: "Importer vers Mini Drive",
      back: "Retour",
    },
  };

  function currentLang() {
    try {
      if (window.DriveSettings && window.DriveSettings.get) {
        return window.DriveSettings.get().language || "en";
      }
      const raw = localStorage.getItem("miniDriveSettings");
      if (raw) return JSON.parse(raw).language || "en";
    } catch (_) {}
    return "en";
  }

  function t(key, vars) {
    const lang = currentLang();
    const table = STRINGS[lang] || STRINGS.en;
    let str = table[key] != null ? table[key] : STRINGS.en[key] || key;
    if (vars) {
      Object.keys(vars).forEach((k) => {
        str = str.replace(new RegExp("\\{" + k + "\\}", "g"), String(vars[k]));
      });
    }
    return str;
  }

  function applyStaticUI() {
    // Sidebar menu labels (text nodes after icons)
    document.querySelectorAll(".menu li").forEach((li) => {
      const view = li.getAttribute("data-view");
      const map = {
        home: "home",
        mydrive: "myDrive",
        shared: "shared",
        starred: "starred",
        recent: "recent",
        trash: "trash",
        settings: "settings",
      };
      const key = map[view];
      if (!key) return;
      // keep icon, replace text
      const icon = li.querySelector(".material-symbols-outlined");
      li.innerHTML = "";
      if (icon) li.appendChild(icon);
      li.appendChild(document.createTextNode(" " + t(key)));
    });

    const storageH = document.querySelector(".storage h4");
    if (storageH) storageH.textContent = t("storage");

    const newBtn = document.querySelector("#newButton");
    if (newBtn) {
      const addIcon = newBtn.querySelector(".material-symbols-outlined");
      // structure: add icon, text, chevron
      const labels = newBtn.childNodes;
      // simpler: find text parts
      const texts = [...newBtn.childNodes].filter((n) => n.nodeType === 3);
      // rebuild carefully
      const chevron = newBtn.querySelector(".new-chevron");
      const add = [...newBtn.querySelectorAll(".material-symbols-outlined")].find(
        (s) => s.textContent.trim() === "add" || !s.classList.contains("new-chevron"),
      );
      newBtn.innerHTML = "";
      if (add) {
        add.textContent = "add";
        newBtn.appendChild(add);
      }
      newBtn.appendChild(document.createTextNode(" " + t("new") + " "));
      if (chevron) newBtn.appendChild(chevron);
    }

    // New menu items
    document.querySelectorAll("#newMenu .new-menu-item").forEach((btn) => {
      const icon = btn.querySelector(".material-symbols-outlined");
      const iconText = icon ? icon.textContent.trim() : "";
      let key = null;
      if (iconText === "create_new_folder") key = "newFolder";
      if (iconText === "drive_folder_upload") key = "uploadFolder";
      if (iconText === "upload_file") key = "uploadFiles";
      if (!key) return;
      const box = btn.querySelector(".menu-icon-box");
      btn.innerHTML = "";
      if (box) btn.appendChild(box);
      const span = document.createElement("span");
      span.textContent = t(key);
      btn.appendChild(span);
    });

    const search = document.getElementById("search");
    if (search) search.placeholder = t("searchPlaceholder");

    const support = document.getElementById("supportBtn");
    if (support) {
      support.title = t("help");
      support.setAttribute("aria-label", t("help"));
    }

    // Empty state static HTML — only top-level buttons, never menu items
    const empty = document.getElementById("driveEmptyState");
    if (empty) {
      const h3 = empty.querySelector("h3");
      const p = empty.querySelector("p");
      if (h3) h3.textContent = t("emptyTitle");
      if (p) p.textContent = t("emptyDesc");
      const newBtn = empty.querySelector("#emptyNewBtn");
      if (newBtn) {
        newBtn.innerHTML =
          t("newFolder") +
          ' <span class="material-symbols-outlined empty-new-chevron">expand_more</span>';
      }
      const uploadBtn = empty.querySelector("#emptyUpload");
      if (uploadBtn) uploadBtn.textContent = t("uploadFiles");
      // Keep dropdown items correct (icons + labels)
      const createItem = empty.querySelector('[data-act="create-folder"] .empty-new-label');
      if (createItem) createItem.textContent = "Create a new folder";
      const uploadFolderItem = empty.querySelector('[data-act="upload-folder"] .empty-new-label');
      if (uploadFolderItem) uploadFolderItem.textContent = "Upload a folder";
    }

    // Folder create modal
    const folderTitle = document.getElementById("folderDialogTitle");
    if (folderTitle) folderTitle.textContent = t("createFolderTitle");
    const folderDialog = document.querySelector(".folder-dialog");
    if (folderDialog) {
      const desc = folderDialog.querySelector(".folder-dialog-header p");
      if (desc) desc.textContent = t("createFolderDesc");
      const label = folderDialog.querySelector(".folder-name-label");
      if (label) label.textContent = t("folderName");
      const cancel = folderDialog.querySelector(".dialog-btn.cancel");
      const create = folderDialog.querySelector(".dialog-btn.create");
      if (cancel) cancel.textContent = t("cancel");
      if (create) create.textContent = t("createFolderBtn");
    }

    // Upload modal title
    const uploadH1 = document.querySelector(".upload-container .top h1");
    if (uploadH1) uploadH1.textContent = t("uploadTitle");
    const backBtn = document.querySelector(".upload-container .back-btn");
    if (backBtn) {
      const icon = backBtn.querySelector(".material-symbols-outlined");
      backBtn.innerHTML = "";
      if (icon) backBtn.appendChild(icon);
      backBtn.appendChild(document.createTextNode(" " + t("back")));
    }

    document.documentElement.lang = currentLang();
  }

  window.DriveI18n = {
    t,
    applyStaticUI,
    currentLang,
    STRINGS,
  };

  // Apply after DOM ready (and after menu data-view attrs exist)
  function boot() {
    // wait a tick for drive.js to set data-view
    setTimeout(applyStaticUI, 50);
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
