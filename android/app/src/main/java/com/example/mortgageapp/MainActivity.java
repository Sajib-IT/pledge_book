package com.example.mortgageapp;

import android.media.AudioManager;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Direct volume buttons strictly to STREAM_MUSIC, preventing inadvertent notification/ring volume drops to 0
        setVolumeControlStream(AudioManager.STREAM_MUSIC);
    }
}
