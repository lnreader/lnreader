package expo.modules.nativewidgets

import android.graphics.Bitmap
import android.os.Build
import androidx.annotation.DrawableRes
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.glance.ColorFilter
import androidx.glance.GlanceModifier
import androidx.glance.GlanceTheme
import androidx.glance.Image
import androidx.glance.ImageProvider
import androidx.glance.action.Action
import androidx.glance.action.clickable
import androidx.glance.appwidget.CircularProgressIndicator
import androidx.glance.appwidget.appWidgetBackground
import androidx.glance.appwidget.cornerRadius
import androidx.glance.background
import androidx.glance.color.ColorProvider
import androidx.glance.color.colorProviders
import androidx.glance.layout.Alignment
import androidx.glance.layout.Box
import androidx.glance.layout.Column
import androidx.glance.layout.ContentScale
import androidx.glance.layout.Row
import androidx.glance.layout.Spacer
import androidx.glance.layout.fillMaxSize
import androidx.glance.layout.fillMaxWidth
import androidx.glance.layout.height
import androidx.glance.layout.padding
import androidx.glance.layout.size
import androidx.glance.layout.width
import androidx.glance.text.FontWeight
import androidx.glance.text.Text
import androidx.glance.text.TextAlign
import androidx.glance.text.TextStyle
import androidx.glance.unit.ColorProvider

/**
 * Design tokens, mapped onto Material 3 roles. Inside [WidgetTheme] they are
 * the wallpaper's dynamic colors on Android 12+; Glance backs those with
 * system color resources, so the launcher re-tints the widget when the
 * wallpaper or dark mode changes without the app pushing an update. Below
 * Android 12 they are the design's Indigo palette.
 */
internal object WidgetColors {
    val bg: ColorProvider @Composable get() = GlanceTheme.colors.surface

    /** Raised tiles and icon-button containers (surface-container-high). */
    val hi: ColorProvider @Composable get() = GlanceTheme.colors.inverseOnSurface
    val on: ColorProvider @Composable get() = GlanceTheme.colors.onSurface
    val onVariant: ColorProvider @Composable get() = GlanceTheme.colors.onSurfaceVariant
    val primary: ColorProvider @Composable get() = GlanceTheme.colors.primary
    val onPrimary: ColorProvider @Composable get() = GlanceTheme.colors.onPrimary
    val primaryContainer: ColorProvider @Composable get() = GlanceTheme.colors.primaryContainer
    val onPrimaryContainer: ColorProvider @Composable get() = GlanceTheme.colors.onPrimaryContainer

    /** Progress track. */
    val track: ColorProvider @Composable get() = GlanceTheme.colors.surfaceVariant

    // Text over cover art stays white in both themes; the scrim guarantees contrast.
    val onCover = ColorProvider(Color.White)
    val onCoverVariant = ColorProvider(Color(0xD1FFFFFF))
    val coverTrack = ColorProvider(Color(0x42FFFFFF))
}

private fun dayNight(day: Long, night: Long) = ColorProvider(day = Color(day), night = Color(night))

/** Indigo seed palette from the design, for launchers without dynamic color. */
private val FallbackColors = colorProviders(
    primary = dayNight(0xFF4C5C92, 0xFFB6C4FF),
    onPrimary = dayNight(0xFFFFFFFF, 0xFF1D2C61),
    primaryContainer = dayNight(0xFFDCE1FF, 0xFF354479),
    onPrimaryContainer = dayNight(0xFF04164B, 0xFFDCE1FF),
    secondary = dayNight(0xFF5A5D72, 0xFFC3C5DD),
    onSecondary = dayNight(0xFFFFFFFF, 0xFF2C2F42),
    secondaryContainer = dayNight(0xFFDFE1F9, 0xFF424659),
    onSecondaryContainer = dayNight(0xFF171B2C, 0xFFDFE1F9),
    tertiary = dayNight(0xFF76546E, 0xFFE5BAD8),
    onTertiary = dayNight(0xFFFFFFFF, 0xFF44263E),
    tertiaryContainer = dayNight(0xFFFFD7F1, 0xFF5C3D55),
    onTertiaryContainer = dayNight(0xFF2D1228, 0xFFFFD7F1),
    error = dayNight(0xFFBA1A1A, 0xFFFFB4AB),
    errorContainer = dayNight(0xFFFFDAD6, 0xFF93000A),
    onError = dayNight(0xFFFFFFFF, 0xFF690005),
    onErrorContainer = dayNight(0xFF410002, 0xFFFFDAD6),
    background = dayNight(0xFFF4F2FA, 0xFF1B1B21),
    onBackground = dayNight(0xFF1B1B21, 0xFFE4E1E9),
    surface = dayNight(0xFFF4F2FA, 0xFF1B1B21),
    onSurface = dayNight(0xFF1B1B21, 0xFFE4E1E9),
    surfaceVariant = dayNight(0xFFC6C5D0, 0xFF45464F),
    onSurfaceVariant = dayNight(0xFF46464F, 0xFFC6C5D0),
    outline = dayNight(0xFF767680, 0xFF90909A),
    inverseOnSurface = dayNight(0xFFE6E5EE, 0xFF292A31),
    inverseSurface = dayNight(0xFF303036, 0xFFE4E1E9),
    inversePrimary = dayNight(0xFFB6C4FF, 0xFF4C5C92),
    widgetBackground = dayNight(0xFFF4F2FA, 0xFF1B1B21),
)

@Composable
internal fun WidgetTheme(content: @Composable () -> Unit) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        GlanceTheme(content = content)
    } else {
        GlanceTheme(colors = FallbackColors, content = content)
    }
}

internal object WidgetDimens {
    /** Rows, buttons and icon buttons must stay at least this tall. */
    val minTouch = 48.dp
    val headerHeight = 56.dp
    val progressHeight = 4.dp
}

internal fun textStyle(
    color: ColorProvider,
    size: TextUnit,
    medium: Boolean = false,
    align: TextAlign? = null,
) = TextStyle(
    color = color,
    fontSize = size,
    fontWeight = if (medium) FontWeight.Medium else FontWeight.Normal,
    textAlign = align,
)

/** Rounded corners only render on Android 12+; Glance ignores them below that. */
internal fun GlanceModifier.rounded(radius: Dp): GlanceModifier = cornerRadius(radius)

@Composable
private fun WidgetSurface(content: @Composable () -> Unit) {
    val surface = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        GlanceModifier
            .background(WidgetColors.bg)
            .cornerRadius(android.R.dimen.system_app_widget_background_radius)
    } else {
        GlanceModifier.background(ImageProvider(R.drawable.lnr_widget_background))
    }
    Box(
        modifier = GlanceModifier.fillMaxSize().appWidgetBackground().then(surface),
        content = content,
    )
}

/** Theme + rounded surface; every widget's root. */
@Composable
internal fun WidgetRoot(content: @Composable () -> Unit) {
    WidgetTheme { WidgetSurface(content = content) }
}

@Composable
internal fun Icon(@DrawableRes res: Int, size: Dp, tint: ColorProvider) {
    Image(
        provider = ImageProvider(res),
        contentDescription = null,
        modifier = GlanceModifier.size(size),
        colorFilter = ColorFilter.tint(tint),
    )
}

/** 4dp rounded bar. Glance has no fractional width, so callers pass the track width. */
@Composable
internal fun ProgressBar(
    progress: Float,
    width: Dp,
    track: ColorProvider = WidgetColors.track,
    fill: ColorProvider = WidgetColors.primary,
) {
    val trackWidth = width.coerceAtLeast(0.dp)
    Box(
        modifier = GlanceModifier
            .width(trackWidth)
            .height(WidgetDimens.progressHeight)
            .rounded(2.dp)
            .background(track),
    ) {
        val fillWidth = trackWidth * progress.coerceIn(0f, 1f)
        if (fillWidth > 0.dp) {
            Box(
                modifier = GlanceModifier
                    .width(fillWidth)
                    .height(WidgetDimens.progressHeight)
                    .rounded(2.dp)
                    .background(fill),
            ) {}
        }
    }
}

/** 2:3 cover, or a tonal placeholder when the image is missing or still loading. */
@Composable
internal fun Cover(bitmap: Bitmap?, width: Dp, height: Dp, radius: Dp, iconSize: Dp) {
    val modifier = GlanceModifier.width(width).height(height).rounded(radius)
    if (bitmap != null) {
        Image(
            provider = ImageProvider(bitmap),
            contentDescription = null,
            modifier = modifier,
            contentScale = ContentScale.Crop,
        )
    } else {
        Box(
            modifier = modifier.background(WidgetColors.primaryContainer),
            contentAlignment = Alignment.Center,
        ) {
            Icon(R.drawable.lnr_widget_ic_menu_book, iconSize, WidgetColors.onPrimaryContainer)
        }
    }
}

/** The small app icon Android expects next to a widget title. */
@Composable
internal fun AppBadge() {
    Box(
        modifier = GlanceModifier
            .size(24.dp)
            .rounded(8.dp)
            .background(WidgetColors.primaryContainer),
        contentAlignment = Alignment.Center,
    ) {
        Icon(R.drawable.lnr_widget_ic_menu_book, 16.dp, WidgetColors.onPrimaryContainer)
    }
}

/** 40dp pill inside a 48dp touch target. */
@Composable
internal fun PillButton(
    text: String,
    onClick: Action,
    container: ColorProvider,
    content: ColorProvider,
    @DrawableRes icon: Int? = null,
) {
    Box(
        modifier = GlanceModifier.height(WidgetDimens.minTouch).clickable(onClick),
        contentAlignment = Alignment.CenterStart,
    ) {
        Row(
            modifier = GlanceModifier
                .height(40.dp)
                .rounded(20.dp)
                .background(container)
                .padding(start = if (icon != null) 12.dp else 18.dp, end = 18.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            if (icon != null) {
                Icon(icon, 20.dp, content)
                Spacer(GlanceModifier.width(6.dp))
            }
            Text(text = text, style = textStyle(content, 14.sp, medium = true), maxLines = 1)
        }
    }
}

/** Refresh icon button; becomes a native spinner while a library update runs. */
@Composable
internal fun RefreshButton(updating: Boolean, onClick: Action) {
    Box(
        modifier = GlanceModifier.size(WidgetDimens.minTouch).clickable(onClick),
        contentAlignment = Alignment.Center,
    ) {
        Box(
            modifier = GlanceModifier.size(40.dp).rounded(20.dp).background(WidgetColors.hi),
            contentAlignment = Alignment.Center,
        ) {
            if (updating) {
                CircularProgressIndicator(
                    modifier = GlanceModifier.size(22.dp),
                    color = WidgetColors.primary,
                )
            } else {
                Icon(R.drawable.lnr_widget_ic_refresh, 22.dp, WidgetColors.onVariant)
            }
        }
    }
}

internal data class Message(
    @DrawableRes val icon: Int,
    val title: String,
    val subtitle: String,
    val action: String?,
    val onAction: Action?,
    /** Tapping anywhere on the widget. */
    val onClick: Action,
)

/** Empty and incognito states for 2x2 widgets. */
@Composable
internal fun CompactMessage(message: Message) {
    Column(
        modifier = GlanceModifier.fillMaxSize().padding(16.dp).clickable(message.onClick),
        verticalAlignment = Alignment.CenterVertically,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Box(
            modifier = GlanceModifier.size(48.dp).rounded(24.dp).background(WidgetColors.hi),
            contentAlignment = Alignment.Center,
        ) {
            Icon(message.icon, 24.dp, WidgetColors.onVariant)
        }
        Spacer(GlanceModifier.height(12.dp))
        Text(
            text = message.title,
            style = textStyle(WidgetColors.on, 14.sp, medium = true, align = TextAlign.Center),
            maxLines = 2,
        )
        if (message.action != null && message.onAction != null) {
            Spacer(GlanceModifier.height(4.dp))
            PillButton(
                text = message.action,
                onClick = message.onAction,
                container = WidgetColors.primaryContainer,
                content = WidgetColors.onPrimaryContainer,
            )
        }
    }
}

/**
 * Empty and incognito states for 4-column widgets. [horizontal] puts the icon
 * beside the text for short (2-row) widgets.
 */
@Composable
internal fun WideMessage(
    message: Message,
    horizontal: Boolean,
    header: (@Composable () -> Unit)? = null,
) {
    Column(modifier = GlanceModifier.fillMaxSize()) {
        header?.invoke()
        Box(
            modifier = GlanceModifier
                .fillMaxWidth()
                .defaultWeight()
                .padding(start = 28.dp, end = 28.dp, bottom = 12.dp)
                .clickable(message.onClick),
            contentAlignment = Alignment.Center,
        ) {
            if (horizontal) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    MessageIcon(message.icon)
                    Spacer(GlanceModifier.width(16.dp))
                    MessageText(message, TextAlign.Start, Alignment.Start)
                }
            } else {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    MessageIcon(message.icon)
                    Spacer(GlanceModifier.height(16.dp))
                    MessageText(message, TextAlign.Center, Alignment.CenterHorizontally)
                }
            }
        }
    }
}

@Composable
private fun MessageIcon(@DrawableRes icon: Int) {
    Box(
        modifier = GlanceModifier.size(56.dp).rounded(28.dp).background(WidgetColors.hi),
        contentAlignment = Alignment.Center,
    ) {
        Icon(icon, 28.dp, WidgetColors.onVariant)
    }
}

@Composable
private fun MessageText(message: Message, align: TextAlign, alignment: Alignment.Horizontal) {
    Column(horizontalAlignment = alignment) {
        Text(
            text = message.title,
            style = textStyle(WidgetColors.on, 16.sp, medium = true, align = align),
            maxLines = 2,
        )
        Spacer(GlanceModifier.height(2.dp))
        Text(
            text = message.subtitle,
            style = textStyle(WidgetColors.onVariant, 12.sp, align = align),
            maxLines = 2,
        )
        if (message.action != null && message.onAction != null) {
            Spacer(GlanceModifier.height(8.dp))
            PillButton(
                text = message.action,
                onClick = message.onAction,
                container = WidgetColors.primaryContainer,
                content = WidgetColors.onPrimaryContainer,
            )
        }
    }
}

/** Header row shared by the list widgets: app badge + title, optional trailing content. */
@Composable
internal fun WidgetHeader(
    title: String,
    onClick: Action?,
    trailing: (@Composable () -> Unit)? = null,
    badge: (@Composable () -> Unit)? = null,
) {
    Row(
        modifier = GlanceModifier
            .fillMaxWidth()
            .height(WidgetDimens.headerHeight)
            .padding(start = 8.dp, end = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        val titleModifier = GlanceModifier
            .defaultWeight()
            .height(WidgetDimens.minTouch)
            .rounded(24.dp)
            .padding(start = 10.dp, end = 10.dp)
        Row(
            modifier = if (onClick != null) titleModifier.clickable(onClick) else titleModifier,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            AppBadge()
            Spacer(GlanceModifier.width(10.dp))
            Text(text = title, style = textStyle(WidgetColors.on, 16.sp, medium = true), maxLines = 1)
            if (badge != null) {
                Spacer(GlanceModifier.width(10.dp))
                badge()
            }
        }
        trailing?.invoke()
    }
}
