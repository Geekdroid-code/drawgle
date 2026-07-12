import React from "react";
import { Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

function Icon({ size = 24, color = "#000" }: { name: string; size?: number; color?: string }) {
  return <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}><Text style={{ color }}>*</Text></View>;
}

type DrawgleBottomNavigationProps = {
  activeTab: string;
  onTabPress: (tab: string) => void;
};

export function DrawgleBottomNavigation({ activeTab, onTabPress }: DrawgleBottomNavigationProps) {
  void activeTab;
  void onTabPress;
  return (
  <View
    style={{
      flexDirection: 'row',
      paddingTop: 7,
      paddingBottom: 7,
      paddingLeft: 7,
      paddingRight: 7,
      borderRadius: 9999,
      borderWidth: 1,
      borderColor: '#FFFFFF',
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      width: '100%'
  }}
  >
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 2 }}>
      <TouchableOpacity 
        onPress={() => {}}
        style={{
          width: '23%',
          height: 50,
          borderRadius: 9999,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center'
  }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            width: 28,
            height: 28,
            borderRadius: 9999
  }}
        >
          <Icon 
            name="home"
            size={10}
            color={'#FFFFFF'}
          />
        </View>
        <Text style={{
          fontSize: 10,
          color: 'currentColor',
          fontWeight: 'bold' }}>
          Home
        </Text>
      </TouchableOpacity>
      <TouchableOpacity 
        onPress={() => {}}
        style={{
          width: '23%',
          height: 50,
          borderRadius: 9999,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center'
  }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            width: 28,
            height: 28,
            borderRadius: 9999
  }}
        >
          <Icon 
            name="trending-up"
            size={10}
            color={'#FFFFFF'}
          />
        </View>
        <Text style={{
          fontSize: 10,
          color: 'currentColor',
          fontWeight: 'bold' }}>
          Markets
        </Text>
      </TouchableOpacity>
      <TouchableOpacity 
        onPress={() => {}}
        style={{
          width: '23%',
          height: 50,
          borderRadius: 9999,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center'
  }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            width: 28,
            height: 28,
            borderRadius: 9999
  }}
        >
          <Icon 
            name="repeat"
            size={10}
            color={'#FFFFFF'}
          />
        </View>
        <Text style={{
          fontSize: 10,
          color: 'currentColor',
          fontWeight: 'bold' }}>
          Swap
        </Text>
      </TouchableOpacity>
      <TouchableOpacity 
        onPress={() => {}}
        style={{
          width: '23%',
          height: 50,
          borderRadius: 9999,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center'
  }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            width: 28,
            height: 28,
            borderRadius: 9999
  }}
        >
          <Icon 
            name="wallet"
            size={10}
            color={'#FFFFFF'}
          />
        </View>
        <Text style={{
          fontSize: 10,
          color: 'currentColor',
          fontWeight: 'bold' }}>
          Wallet
        </Text>
      </TouchableOpacity>
    </View>
  </View>
  );
}
