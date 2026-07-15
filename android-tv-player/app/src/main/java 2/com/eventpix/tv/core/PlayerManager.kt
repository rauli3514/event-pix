package com.eventpix.tv.core

import android.content.Context
import android.net.Uri
import android.util.Log
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.PlayerView

class PlayerManager(private val context: Context, private val playerView: PlayerView) {
    
    private var exoPlayer: ExoPlayer? = null
    
    fun initializePlayer() {
        if (exoPlayer == null) {
            exoPlayer = ExoPlayer.Builder(context).build()
            playerView.player = exoPlayer
            
            exoPlayer?.addListener(object : Player.Listener {
                override fun onPlaybackStateChanged(playbackState: Int) {
                    when (playbackState) {
                        Player.STATE_BUFFERING -> Log.d("PlayerManager", "Buffering...")
                        Player.STATE_READY -> Log.d("PlayerManager", "Ready to play")
                        Player.STATE_ENDED -> {
                            Log.d("PlayerManager", "Playback ended")
                            // TODO: Call next item in playlist
                        }
                        Player.STATE_IDLE -> Log.d("PlayerManager", "Idle")
                    }
                }
            })
        }
    }
    
    fun playMedia(uri: Uri) {
        val mediaItem = MediaItem.fromUri(uri)
        exoPlayer?.setMediaItem(mediaItem)
        exoPlayer?.prepare()
        exoPlayer?.play()
    }
    
    fun releasePlayer() {
        exoPlayer?.release()
        exoPlayer = null
    }
}
