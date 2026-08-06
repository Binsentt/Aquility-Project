import React, { useMemo } from 'react';
import { View, Image, ScrollView, StyleSheet, TouchableOpacity, Text } from 'react-native';

const ThumbnailStrip = React.memo(function ThumbnailStrip({ images = [], onSelect, onRemove }) {
  const visibleImages = useMemo(() => images.slice(0, 6), [images]);

  if (!visibleImages.length) {
    return null;
  }

  return (
    <View style={styles.container} pointerEvents="box-none">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.content}
        decelerationRate="fast"
      >
        {visibleImages.map((uri, index) => (
          <View key={`${uri}-${index}`} style={styles.thumbWrapper}>
            <TouchableOpacity activeOpacity={0.9} style={styles.thumbButton} onPress={() => onSelect?.(uri, index)}>
              <Image source={{ uri }} style={styles.thumb} />
            </TouchableOpacity>
            {onRemove ? (
              <TouchableOpacity style={styles.removeButton} onPress={() => onRemove(uri, index)}>
                <Text style={styles.removeText}>×</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ))}
      </ScrollView>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    height: 90,
  },
  content: {
    paddingRight: 12,
    alignItems: 'center',
  },
  thumbWrapper: {
    width: 82,
    height: 82,
    borderRadius: 16,
    overflow: 'hidden',
    marginRight: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  thumbButton: {
    flex: 1,
  },
  thumb: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  removeButton: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 16,
  },
});

export default ThumbnailStrip;
