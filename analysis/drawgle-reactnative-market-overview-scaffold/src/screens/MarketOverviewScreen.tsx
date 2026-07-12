import React from "react";
import { SafeAreaView, ScrollView, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { AppTheme } from "../theme/AppTheme";

function Icon({ size = 24, color = "#000" }: { name: string; size?: number; color?: string }) {
  return <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}><Text style={{ color }}>*</Text></View>;
}

export default function MarketOverviewScreen() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: AppTheme.colors.backgroundPrimary }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
  <View
    style={{
      flexDirection: 'column',
      width: '100%',
      backgroundColor: AppTheme.colors.backgroundPrimary
  }}
  >
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: AppTheme.layout.screenPadding,
        paddingTop: 16
  }}
    >
      <View style={{
        position: 'relative' }}>
        <View style={{
          flexDirection: 'row',
          width: '100%',
          height: '100%' }}>
          <View
            style={{
              flexDirection: 'column',
              width: '100%',
              height: 48,
              paddingLeft: 48,
              paddingRight: 16,
              borderRadius: AppTheme.radii.pill
  }}
          >
          </View>
        </View>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            position: 'absolute',
            left: 16
  }}
        >
          <Icon 
            name="search"
            size={24}
            color={AppTheme.colors.textLow}
          />
        </View>
      </View>
      <TouchableOpacity 
        onPress={() => {}}
        style={{
          width: 48,
          height: 48,
          backgroundColor: '#F7F8FA',
          borderRadius: 9999,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center'
  }}
      >
        <Icon 
          name="more-horizontal"
          size={24}
          color={AppTheme.colors.textMedium}
        />
      </TouchableOpacity>
    </View>
    <View
      style={{
        flexDirection: 'row',
        flex: 1,
        paddingTop: AppTheme.layout.elementGap,
        paddingBottom: 128
  }}
    >
      <View
        style={{
          flexDirection: 'column',
          paddingHorizontal: AppTheme.layout.screenPadding
  }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingTop: 16,
            paddingBottom: 16,
            paddingLeft: 16,
            paddingRight: 16,
            backgroundColor: AppTheme.colors.surfaceCard,
            borderRadius: AppTheme.radii.app,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.04,
            shadowRadius: 15,
            elevation: 2
  }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 16
  }}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                width: 48,
                height: 48,
                borderRadius: 9999
  }}
            >
              <Icon 
                name="layers"
                size={24}
                color={'#FFFFFF'}
              />
            </View>
            <View
              style={{
                flexDirection: 'column'
  }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 4
  }}
              >
                <Text style={{
                  fontSize: 18,
                  color: AppTheme.colors.textHigh,
                  fontWeight: '600' }}>
                  Ethereum
                </Text>
                <Text style={{
                  fontSize: 14,
                  color: AppTheme.colors.textMedium,
                  fontWeight: '500' }}>
                  ETH
                </Text>
              </View>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8
  }}
              >
                <Text style={{
                  fontSize: 16,
                  color: AppTheme.colors.textHigh,
                  fontWeight: 'normal' }}>
                  $1,263.00
                </Text>
                <Text style={{
                  fontSize: 12,
                  color: '#FF4D4D',
                  fontWeight: 'normal' }}>
                  -2.39%
                </Text>
              </View>
            </View>
          </View>
          <TouchableOpacity 
            onPress={() => {}}
            style={{
              width: 40,
              height: 40,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center'
  }}
          >
            <Icon 
              name="arrow-right"
              size={24}
              color={AppTheme.colors.textMedium}
            />
          </TouchableOpacity>
        </View>
      </View>
      <View
        style={{
          flexDirection: 'column',
          gap: 16,
          paddingHorizontal: AppTheme.layout.screenPadding
  }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            height: 140,
            paddingLeft: 8,
            paddingRight: 8
  }}
        >
          <View
            style={{
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4
  }}
          >
            <Text style={{
              fontSize: 12,
              color: AppTheme.colors.textMedium,
              fontWeight: 'normal' }}>
              33
            </Text>
            <View
              style={{
                flexDirection: 'column',
                width: 8,
                height: 60
  }}
            >
            </View>
          </View>
          <View
            style={{
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4
  }}
          >
            <Text style={{
              fontSize: 12,
              color: AppTheme.colors.textMedium,
              fontWeight: 'normal' }}>
              21
            </Text>
            <View
              style={{
                flexDirection: 'column',
                width: 8,
                height: 40
  }}
            >
            </View>
          </View>
          <View
            style={{
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4
  }}
          >
            <Text style={{
              fontSize: 12,
              color: AppTheme.colors.textMedium,
              fontWeight: 'normal' }}>
              25
            </Text>
            <View
              style={{
                flexDirection: 'column',
                width: 8,
                height: 50
  }}
            >
            </View>
          </View>
          <View
            style={{
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4
  }}
          >
            <Text style={{
              fontSize: 12,
              color: AppTheme.colors.textMedium,
              fontWeight: 'normal' }}>
              38
            </Text>
            <View
              style={{
                flexDirection: 'column',
                width: 8,
                height: 80
  }}
            >
            </View>
          </View>
          <View
            style={{
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4
  }}
          >
            <Text style={{
              fontSize: 12,
              color: AppTheme.colors.textMedium,
              fontWeight: 'normal' }}>
              35
            </Text>
            <View
              style={{
                flexDirection: 'column',
                width: 8,
                height: 70
  }}
            >
            </View>
          </View>
          <View
            style={{
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4
  }}
          >
            <Text style={{
              fontSize: 12,
              color: AppTheme.colors.textMedium,
              fontWeight: 'normal' }}>
              20
            </Text>
            <View
              style={{
                flexDirection: 'column',
                width: 8,
                height: 35
  }}
            >
            </View>
          </View>
          <View
            style={{
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4
  }}
          >
            <Text style={{
              fontSize: 12,
              color: AppTheme.colors.textMedium,
              fontWeight: 'normal' }}>
              16
            </Text>
            <View
              style={{
                flexDirection: 'column',
                width: 8,
                height: 25
  }}
            >
            </View>
          </View>
          <View
            style={{
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4
  }}
          >
            <Text style={{
              fontSize: 12,
              color: AppTheme.colors.textMedium,
              fontWeight: 'normal' }}>
              26
            </Text>
            <View
              style={{
                flexDirection: 'column',
                width: 8,
                height: 55
  }}
            >
            </View>
          </View>
          <View
            style={{
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4
  }}
          >
            <Text style={{
              fontSize: 12,
              color: AppTheme.colors.textMedium,
              fontWeight: 'normal' }}>
              22
            </Text>
            <View
              style={{
                flexDirection: 'column',
                width: 8,
                height: 45
  }}
            >
            </View>
          </View>
          <View
            style={{
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4
  }}
          >
            <Text style={{
              fontSize: 12,
              color: AppTheme.colors.textMedium,
              fontWeight: 'normal' }}>
              18
            </Text>
            <View
              style={{
                flexDirection: 'column',
                width: 8,
                height: 30
  }}
            >
            </View>
          </View>
          <View
            style={{
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4
  }}
          >
            <Text style={{
              fontSize: 12,
              color: AppTheme.colors.textMedium,
              fontWeight: 'normal' }}>
              35
            </Text>
            <View
              style={{
                flexDirection: 'column',
                width: 8,
                height: 70
  }}
            >
            </View>
          </View>
        </View>
        <View
          style={{
            flexDirection: 'column',
            gap: 8
  }}
        >
          <View
            style={{
              flexDirection: 'row',
              width: '100%',
              borderRadius: 9999
  }}
          >
            <View
              style={{
                flexDirection: 'column'
  }}
            >
            </View>
            <View
              style={{
                flexDirection: 'column'
  }}
            >
            </View>
            <View
              style={{
                flexDirection: 'column'
  }}
            >
            </View>
          </View>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between'
  }}
          >
            <Text style={{
              fontSize: 12,
              color: AppTheme.colors.textMedium,
              fontWeight: 'normal' }}>
              Up: 283
            </Text>
            <Text style={{
              fontSize: 12,
              color: AppTheme.colors.textMedium,
              fontWeight: 'normal' }}>
              Down: 1472
            </Text>
          </View>
        </View>
      </View>
      <View
        style={{
          flexDirection: 'column',
          paddingHorizontal: AppTheme.layout.screenPadding
  }}
      >
        <Text style={{
          fontSize: 18,
          color: AppTheme.colors.textHigh,
          fontWeight: '600',
          marginBottom: AppTheme.layout.elementGap }}>
          Hot coins
        </Text>
        <View
          style={{
            flexDirection: 'column',
            gap: 8
  }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingTop: 12,
              paddingBottom: 12
  }}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12
  }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 40,
                  height: 40,
                  borderRadius: 9999
  }}
              >
                <Image 
                  source={{ uri: 'https://images.pexels.com/photos/4808279/pexels-photo-4808279.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940' }}
                  alt="Bitcoin"
                  resizeMode={'cover'}
                  style={{
                    width: '100%',
                    height: '100%'
  }}
                />
              </View>
              <View
                style={{
                  flexDirection: 'column'
  }}
              >
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 4
  }}
                >
                  <Text style={{
                    fontSize: 14,
                    color: AppTheme.colors.textHigh,
                    fontWeight: '500' }}>
                    Bitcoin
                  </Text>
                  <Text style={{
                    fontSize: 12,
                    color: AppTheme.colors.textLow,
                    fontWeight: 'normal' }}>
                    BTC
                  </Text>
                </View>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8
  }}
                >
                  <Text style={{
                    fontSize: 12,
                    color: AppTheme.colors.textHigh,
                    fontWeight: 'normal' }}>
                    $1,846.00
                  </Text>
                  <Text style={{
                    fontSize: 12,
                    color: '#FF4D4D',
                    fontWeight: 'normal' }}>
                    -1.68%
                  </Text>
                </View>
              </View>
            </View>
            <View
              style={{
                flexDirection: 'column',
                width: 80,
                height: 32
  }}
            >
              <View style={{ width: 48, height: 48 }}>{/* TODO: Add custom SVG/Asset */}</View>
            </View>
          </View>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingTop: 12,
              paddingBottom: 12
  }}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12
  }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 40,
                  height: 40,
                  borderRadius: 9999
  }}
              >
                <Icon 
                  name="link"
                  size={24}
                  color={'#FFFFFF'}
                />
              </View>
              <View
                style={{
                  flexDirection: 'column'
  }}
              >
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 4
  }}
                >
                  <Text style={{
                    fontSize: 14,
                    color: AppTheme.colors.textHigh,
                    fontWeight: '500' }}>
                    Litecoin
                  </Text>
                  <Text style={{
                    fontSize: 12,
                    color: AppTheme.colors.textLow,
                    fontWeight: 'normal' }}>
                    LTC
                  </Text>
                </View>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8
  }}
                >
                  <Text style={{
                    fontSize: 12,
                    color: AppTheme.colors.textHigh,
                    fontWeight: 'normal' }}>
                    $216.00
                  </Text>
                  <Text style={{
                    fontSize: 12,
                    color: '#00C566',
                    fontWeight: 'normal' }}>
                    +2.46%
                  </Text>
                </View>
              </View>
            </View>
            <View
              style={{
                flexDirection: 'column',
                width: 80,
                height: 32
  }}
            >
              <View style={{ width: 48, height: 48 }}>{/* TODO: Add custom SVG/Asset */}</View>
            </View>
          </View>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingTop: 12,
              paddingBottom: 12
  }}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12
  }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 40,
                  height: 40,
                  borderRadius: 9999
  }}
              >
                <Image 
                  source={{ uri: 'https://images.pexels.com/photos/29012802/pexels-photo-29012802.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940' }}
                  alt="Cardano"
                  resizeMode={'cover'}
                  style={{
                    width: '100%',
                    height: '100%'
  }}
                />
              </View>
              <View
                style={{
                  flexDirection: 'column'
  }}
              >
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 4
  }}
                >
                  <Text style={{
                    fontSize: 14,
                    color: AppTheme.colors.textHigh,
                    fontWeight: '500' }}>
                    Cardano
                  </Text>
                  <Text style={{
                    fontSize: 12,
                    color: AppTheme.colors.textLow,
                    fontWeight: 'normal' }}>
                    ADA
                  </Text>
                </View>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8
  }}
                >
                  <Text style={{
                    fontSize: 12,
                    color: AppTheme.colors.textHigh,
                    fontWeight: 'normal' }}>
                    $846.00
                  </Text>
                  <Text style={{
                    fontSize: 12,
                    color: '#00C566',
                    fontWeight: 'normal' }}>
                    +0.27%
                  </Text>
                </View>
              </View>
            </View>
            <View
              style={{
                flexDirection: 'column',
                width: 80,
                height: 32
  }}
            >
              <View style={{ width: 48, height: 48 }}>{/* TODO: Add custom SVG/Asset */}</View>
            </View>
          </View>
        </View>
      </View>
    </View>
  </View>
      </ScrollView>
    </SafeAreaView>
  );
}
